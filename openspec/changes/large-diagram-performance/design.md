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

- **Edges (implemented, `edges/culling/`):** `DiagramSurface` (editor and viewer) passes React
  Flow only the edges whose route box overlaps the culling window. The route box covers both
  endpoint node boxes (from React Flow's `nodeLookup`, absolute and measured) and every stored
  corner (`data.layoutPoints`, already stamped on both surfaces), so it holds everything the edge
  draws. The window is the viewport grown by one viewport on every side, with its origin snapped
  to half-viewport cells and its zoom snapped to quarter octaves, so it only changes when a pan
  crosses a cell. It is computed by **one** React Flow store selector for the whole canvas,
  memoised on (window, React Flow's node array, our edge array). Selected edges, the playback
  step, and edges with an unmeasured endpoint are always kept. Below 200 edges, nothing is
  culled.
  - _Changed from the first draft:_ the route box is **not** stamped on `edge.data`. That would
    give every edge attached to a moving node new `data` on every frame, which undoes the identity
    work of group 3.
  - _Mounted set:_ during a gesture it only grows. Edges that left the window unmount together
    once it has been still for 400 ms, so a pan back and forth never pays unmount plus remount.
  - _Measured and rejected:_ mounting a large growth in batches of 50 per frame. Each batch pays
    React Flow's edge update and the global line-hop recompute again. Zoom long tasks went from
    260 ms to 406 ms, so growth stays immediate.
- **Nodes (spike, task 4.5): option (a), no node culling for now.** Re-measured after group 5:
  opening costs ~608 ms of long tasks (from 954 ms on `main`), pan runs at ~78 fps, and panel drag
  at ~42 fps with one long task. Node culling would cut opening further, at the risk described in
  (b) and (c). It is not worth taking on until a diagram measures worse than the fixture. The
  earlier analysis follows.
- **Nodes (history): deferred until after the level of detail (group 5).** Measured after
  edge culling, opening costs the same (~820 ms of long tasks) with 151 edges mounted as with 711. Opening is dominated by the 657 nodes and their first measurement. But node culling means
  options (b) or (c) below, both larger and riskier than edge culling, while group 5 lowers the
  cost of every node at far zoom with no structural risk. Re-measure after group 5, then pick:
  - **(a)** No node culling, if the remaining node cost is small.
  - **(b)** Our own node culling through a lightweight off-screen renderer that keeps the node
    box and its handles mounted, so handle bounds stay valid, and drops everything else.
  - **(c)** A `patch-package` patch to `isEdgeVisible` that reads the route box, so that React
    Flow's `onlyRenderVisibleElements` can cull nodes without dropping long or detoured edges.
    Only with an ADR.

  Declaring `node.handles` statically for every node type stays rejected. It would be a second
  source of truth for the handle sides of ADR-0013.

- **Non-render consumers** read the store or React Flow's nodes, never the culled edge array.
  Verified on the fixture in a production build: select all + delete removes all 711
  connections, one undo restores them, and the empty-viewport card counts all 657 elements with
  0 edges mounted. The only `getEdges()` reader (reset waypoints) looks for selected edges, and
  those are always kept.

### 4. Level of detail: a light edge component, CSS for nodes

- A single canvas-level component, `CanvasLodSync` (next to `EdgeLabelPortalHost`), reads the
  zoom once. It writes `data-lod="far" | "full"` on the React Flow wrapper and publishes the level
  through `CanvasLodContext`, with hysteresis: far below 0.45, full again above 0.5. Both
  thresholds live in `canvas.constants.ts`. The context changes once per crossing, never per zoom
  frame.
- **Edges (JavaScript).** The first draft hid edge chrome with CSS. A profile of the zoom-out
  showed that the cost is React mounting edges, which CSS cannot remove. So `EditableEdge` became
  a thin chooser. At far detail, an edge that is not selected, not revealed by a selected end,
  not highlighted and not the step being played renders `FarEdge`. `FarEdge` draws only the
  stroke and arrowheads on the resting path (`geometry/restingEdgePath.ts`, the same geometry
  minus line hops), keeps React Flow's interaction path so it can still be clicked, and runs none
  of the editing hooks. It also publishes no line-hop path. Crossing the threshold remounts the
  edges on screen once, which is accepted, because every mount after that at far zoom is cheap.
- **Nodes (CSS).** Secondary content (`data-lod-secondary`: description, technology tag and
  action row on `CardNode`) gets `visibility: hidden`, never `display: none`. The node keeps its
  size, so React Flow does not re-measure it and no handle or edge moves at the threshold. Measured
  in headless Chromium, this had **no measurable effect** (open 607 vs 608 ms, pan 81 vs 78 fps,
  within noise). It is kept because it is the node half of the spec and costs nothing, and paint
  on a real GPU may differ.
- **Found while measuring:** the culling hook kept what a zoom-in left behind for the 400 ms
  release delay. A zoom-in that crossed into full detail therefore rendered all ~580 retained
  edges in full (1,758 `FullEditableEdge` renders). Zooming in now releases at once. The
  grow-only rule still holds for pans and zoom-outs.
- **Alternative: per-node `useStore(s => s.transform[2] < T)`.** Rejected, because it violates
  §6.
- **Alternative: swap whole node components at far zoom.** Rejected. It remounts every node at
  the crossing, and nodes are the most expensive part of the canvas.

### 5. Line hops: scoped by culling and level of detail, not made incremental

The plan was to make the registry recompute only the neighbourhood of changed routes. After groups
4 and 5 that was measured first. The registry only sees mounted edges drawn in full: culled edges
are not mounted, and `FarEdge` publishes nothing. Dragging the 97-child panel at full detail
spent about 10 ms of 899 ms of JavaScript in line hops at zoom 0.6 (69 edges mounted), and about
3 ms of 539 ms at zoom 1.0 (31 edges mounted), roughly 1%. The incremental recompute is
therefore **not implemented**. It would add a second algorithm and a property test to save about
1%. Revisit only if a profile shows `findLineHops` above about 10% of a gesture.

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
