# Design

## Context

See `proposal.md` (Why) for the baseline and profile. The current state that shapes the approach:

- **Viewport writes.** The wheel handler in `hooks/useCanvasEffects.ts` coalesces wheel events
  into one `setViewport` per animation frame. Each call ends a d3-zoom "gesture", so React Flow
  fires `onMoveEnd` once per frame. `useCanvasEventHandlers.onMoveEnd` then calls
  `updateViewport`, which is a full diagram-store `set()`. The viewport is local to the user and
  never synced to collaborators (`collaboration/sync/diagramState.ts`).
- **Persistence.** `wrapIStoragePortWithDiagramPersistTracking` already debounces the **I/O**
  by `PERSIST_DEBOUNCE_MS` and flushes on `beforeunload`, `pagehide` and `visibilitychange`.
  But it sits behind `createJSONStorage`, so `JSON.stringify` of the whole workspace runs on
  every `set()` before the debounce sees the value.
- **React Flow culling.** `onlyRenderVisibleElements` is a single prop that culls nodes
  (`useVisibleNodeIds`) **and** edges (`useVisibleEdgeIds`). Edges are tested with
  `isEdgeVisible`, which takes the bounds of the two endpoint node boxes and ignores the route,
  and there is no hook to override it.
- **Edges and unmounted endpoints.** An edge needs its endpoint nodes in `nodeLookup` with
  dimensions and handle bounds (`getEdgePosition`). It does not need them mounted. Handle bounds
  come from DOM measurement, or from declared `node.handles` as a fallback (`toHandleBounds`).
  Measured internals survive node array replacement only when `measured` is carried over. That
  is already guaranteed by `useLocalNodes` (`withLocalMeasured`, see `canvas-hot-path.md` §5).
- **Line hops.** `lineHopsRegistry` recomputes `findLineHops` over **every** published path once
  per frame when any path changes, then notifies only the edges whose hops changed.
- **Zoom-driven CSS precedent.** `EdgeLabelPortal` writes `data-labels-collapsed` on its
  container from the zoom, so a CSS rule collapses labels with zero React renders.

## Goals / Non-Goals

**Goals:**

- Each phase lands separately, with before and after numbers from `npm run perf:large`.
- No phase adds a per-node or per-edge subscription to a canvas-wide value (`canvas-hot-path.md`
  §6), and none breaks identity caching (§5).

**Non-Goals:**

- Changing React Flow's source. Forking or patching `@xyflow/*` is the last resort and is not
  planned. See Decision 3 for when it would be reconsidered.
- Making the first open of a huge diagram cheaper than a single full render, in this change.
  Culling and level of detail make every frame after it cheaper.

## Decisions

### 1. Viewport: write on settle, not on `onMoveEnd`

`onMoveEnd` schedules a trailing write (~250 ms idle) instead of writing. A new `onMoveEnd`
replaces the pending one. The pending write is flushed on diagram switch, `pagehide` and
`visibilitychange`, and on unmount of the canvas for that diagram.

- **Alternative: debounce inside `updateViewport` in the slice.** Rejected. The store action
  would stop meaning "write now", and every other caller (fit view, focus, flow playback) wants
  the immediate write.
- **Alternative: stop the wheel handler from producing `onMoveEnd`.** Rejected. Minimap drags,
  keyboard pan and touch also end gestures, and a single settle point covers all of them.

### 2. Persistence: serialize on flush, not on `set()`

Replace `createJSONStorage(() => trackedStorage)` with a `PersistStorage` that hands the
**state object** to the tracking wrapper. The wrapper keeps the latest state reference and
calls `JSON.stringify` only when the debounce fires or a leave event forces a flush. This is
safe because Immer state is immutable and structurally shared, so a held reference is a stable
snapshot. Everything still goes through `IStoragePort`, and the save-status store keeps its
`saving` → `saved` transitions, which are set when a write is scheduled, not when it is
serialized.

- **Alternative: raise `PERSIST_DEBOUNCE_MS`.** Rejected. It does nothing for the stringify,
  which happens before the debounce.

### 3. Culling: own route-aware edge culling first, node culling gated on a spike

- **Edges (always):** `buildEdge` stamps a route box on `edge.data`, from the endpoints and the
  stored corners. A single canvas-level hook keeps the set of visible edge ids for the viewport
  plus a margin. The margin is one viewport on each side, so short pans do not churn the set. The
  set is recomputed on viewport settle and at most once per frame during a pan, and only when the
  viewport has left the margin band. The `edges` array handed to React Flow is filtered by that
  set, and edge **objects** keep their identity, so only the array reference changes when the
  set changes. Edges that are selected, being edited, hovered by a collaborator or part of the
  active flow step are always kept.
- **Nodes (spike, task 4.1):** React Flow's flag would also apply its endpoint-box test to edges,
  which drops detoured or long edges that our filter kept. That violates the spec ("A detoured
  edge outside its endpoints' box"). The spike measures node-side cost after phases 1–3 and picks
  one of these:
  - **(a)** No node culling, if the remaining node cost is small. Expected once pan no longer
    re-renders `Canvas`.
  - **(b)** Our own node culling through a lightweight off-screen renderer that keeps the node
    box and its handles mounted, so handle bounds stay valid, and drops everything else.
  - **(c)** A `patch-package` patch to `isEdgeVisible` that reads the route box from
    `edge.data`. Only if (a) and (b) leave over 25% of the open or pan cost on the table, and
    only with a decision recorded in an ADR.

  Declaring `node.handles` statically for every node type was considered and rejected for now.
  It would have to reproduce `buildHandles` for every element family, both reading directions,
  `verticalSides` and panel ports, which is a second source of truth for ADR-0013.

- **Selection and other non-visual consumers** keep reading the store and React Flow's full
  `nodes` and `edges`, never the DOM. `useViewportOccupancy` keeps counting from `nodeLookup`.

### 4. Level of detail: CSS first, one context for JavaScript-only work

- A single canvas-level component (next to `EdgeLabelPortalHost`) reads the zoom once and
  writes `data-lod="far" | "full"` on the React Flow wrapper, with hysteresis around the
  threshold so a zoom resting at the line does not flicker. CSS hides the secondary node content,
  the edge label chrome and the widened hit areas under `[data-lod="far"]`. Crossing the
  threshold costs no React renders.
- Work that CSS cannot remove, which is line-hop computation and arc paths, reads the level from
  a context whose value changes only when the bucket changes. That is one notification per
  crossing, not per frame.
- The threshold starts at 0.45, which is where node text is about 6 px. It is tuned with the
  harness, and lives in `canvas.constants.ts`.
- **Alternative: per-node `useStore(s => s.transform[2] < T)`.** Rejected, because it violates
  §6.
- **Alternative: swap whole node components at far zoom.** Rejected. It remounts every node at
  the crossing, which is the most expensive moment to do it.

### 5. Line hops: incremental by route box

The registry keeps each path's box. On recompute it collects the changed and removed ids, finds
the edges whose boxes overlap the changed ones (a linear scan over boxes is fine at around 700
edges, and a grid comes only if the measurement says so), and runs `findLineHops` on that
neighbourhood only. A property test checks the result against a full recompute. While
`data-lod` is far, edges publish `null` (no hops), and the registry skips work.

### 6. Measurement harness

`cypress/support/seed-large-diagram.ts` produces a deterministic fixture written at the current
`PERSIST_SCHEMA_VERSION`. `scripts/perf-large-diagram.ts` (Playwright, `npm run perf:large`)
reports open, pan, zoom, child drag and panel drag, each with frame percentiles, long tasks and
a `moved` check based on the node's canvas transform. Run it against `vite preview`, not the dev
server.

## Risks / Trade-offs

- **[Risk] A deferred viewport write is lost when the tab is closed mid-gesture.** → The pending
  write is flushed on the same leave events persistence already uses. Losing a viewport is
  cosmetic.
- **[Risk] Serializing on flush runs inside `beforeunload` with a 1 MB workspace.** → This is
  the same work the current sync `flushOnLeave` path already does today with the pending string.
  It just moves where the stringify happens.
- **[Risk] Edge culling desyncs from React Flow's internal edge set** (connection drag, reconnect,
  `getEdges()` callers). → Culling filters only what is **rendered**. Gesture handlers read the
  store or the full built edge list through refs, and a test asserts that `getEdges()`-dependent
  features (reconnect, delete selection) see culled edges.
- **[Risk] The CSS level of detail hides something a user needs at far zoom.** → The level keeps
  name, type color and box. The harness screenshot at 0.3 goes in the PR for review.
- **[Trade-off] Opening still renders every node once.** → It is accepted in this change and
  revisited by the node-culling spike.
- **[Risk] The numbers come from a headless M-series machine.** → They are used only as relative
  before and after numbers on the same machine. The user's real diagrams validate the result.

## Migration Plan

There is no persisted schema change. Each phase is independently revertible. The level of detail
and edge culling ship always-on, guarded by constants (threshold and margin), not by a feature
flag, because both are meant to be invisible except in cost.

## Open Questions

- The exact level-of-detail threshold and culling margin. They are tuned with the harness and do
  not change the approach.
