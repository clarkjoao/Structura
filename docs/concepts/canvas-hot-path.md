# Canvas hot path

Rules and remaining opportunities from the Sep 2026 drag-performance work.

Measured on a production build, 400 nodes / 439 edges: one `set()` on the
diagram store cost ~1 s of long tasks; one `EdgeLabelRenderer` per edge cost
~291 ms of a 2.1 s drag. The strategies below are why node movement now
stays at interactive frame rates. **Do not regress them.** Remaining
opportunities are listed for future work — do not implement them as a
drive-by while touching unrelated code.

Related: [canvas-engine.md](./canvas-engine.md),
[rendering-pipeline.md](./rendering-pipeline.md),
[edge-labels-drag-parenting.md](./edge-labels-drag-parenting.md),
[state-management.md](./state-management.md).

---

## When it fires

| Phase | What must stay cheap | What is allowed to be expensive |
| --- | --- | --- |
| **Drag frame** | React Flow `setNodes`, parenting lookup, label portals, event-handler identity | Nothing that walks all nodes/edges or writes the diagram store |
| **Gesture commit** | One store `set()`, one history checkpoint, one collab patch | O(N) hit-tests, rebuilding one changed entity |
| **Idle / other writes** | Unchanged nodes/edges keep the same object identity | Rebuilding the one entity that actually changed |

A drag frame never writes the diagram store (`useLocalNodes`). A store write
never happens “a little” — every `set()` notifies every subscriber, re-runs the
canvas projection and schedules a persist. The workspace itself is serialised
once per persist debounce, at flush time, not per `set()`
(`persist.deferred-serialization.test.ts`). A continuous viewport gesture writes
the store once, when it settles (`useSettledViewportWrite.test.ts`).

---

## Strategies that must not regress

Apply these when adding canvas, store, or collaboration code. A feature that
looks cheap on a 20-node diagram can dominate a 400-node one.

### 1. One React Flow portal host, N portals

React Flow's `<EdgeLabelRenderer>` (and the same family: `<NodeToolbar>`,
`<ViewportPortal>`) is a store subscriber. Its selector is
`domNode?.querySelector('.react-flow__edgelabel-renderer')` and it runs on
**every** RF store notification — including every drag frame, because
`setNodes` replaces `nodes`.

| Do | Don't |
| --- | --- |
| Mount exactly one host (`EdgeLabelPortalHost`) and `createPortal` into it | Import `EdgeLabelRenderer` from `@xyflow/react` inside an edge/node component |
| Attach the shared container with a **ref callback** | `useEffect([container])` — the renderer often returns `null` on the first paint and later portals the mount without re-rendering the host |

Enforced by `EdgeLabelPortal.test.tsx` walking `features/canvas`. If you
need a new edge overlay, wrap it in `<EdgeLabelPortal>`.

### 2. Build indexes once per gesture; frames are O(1)

Panels do not move while a child is dragged. A dragged panel is excluded
from the drop-target list. That answer is stable for the whole gesture.

| Do | Don't |
| --- | --- |
| Build a `GesturePanelIndex` on the first dragging frame (`ensureGesture`) | `findPanelContainingPoint` / `filter` the node list every frame |
| Resolve absolute positions from **one** coordinate authority | Mix `useLocalNodes` positions with store `nodeLayouts` mid-gesture |

`useNodeDragParenting.hotpath.test.tsx` fails if a frame after the first
scans the node array.

### 3. Event handlers React Flow tracks must be referentially stable

React Flow writes `onNodesChange`, `onNodeDragStop`, `onConnect`,
`onConnectEnd`, … into its own store. A new function identity notifies every
node/edge subscriber on screen.

| Do | Don't |
| --- | --- |
| Close over refs (`nodesRef`, `diagramRef`) for values that change every frame | Put `nodes` in a `useCallback` dependency that RF tracks |
| Wrap `screenToFlowPosition` once | Inline arrows in `<ReactFlow onConnectEnd={…} />` |

### 4. One `set()` per user gesture (or per measure round)

Each diagram-store `set()` serializes the workspace for persist and fans
into history + collab. Measured: one arrow-key nudge used to be 800+
`JSON.stringify` calls.

| Do | Don't |
| --- | --- |
| Collect every moved node and call `batchCommitNodeDrag` once | A separate commit + `updateNodeLayout` per selected node |
| Flush ResizeObserver sizes with `batchUpdateNodeLayouts` (no history) | `updateNodeLayout` once per measured node |
| History: one structural checkpoint per gesture | Two `STRUCTURAL` checkpoints for one multi-select drag |

`useNodeDragParenting.singleCommit.test.tsx` and
`useNodeDragParenting.dimensionFlush.test.tsx` lock the call counts.

### 5. Identity caches for arrays React Flow owns

React Flow remounts a layer when it receives a new array of new objects.
`buildNode` / `buildEdge` allocate nested objects (`data`, `style`, markers)
every call even when contents did not move.

| Do | Don't |
| --- | --- |
| Keep a per-id cache; reuse nested objects when shallow-equal; reuse the edge/node object; reuse the array if every member is the same reference | Rebuild every `Edge` because one node moved or one edge was selected |
| Mirror the node cache (`useCanvasNodes`) when adding a new derived RF array | Hand RF a fresh `edges={visible.map(buildEdge)}` |

`useCanvasEdges.identity.test.ts` is the contract: moving one node must
leave all edge objects (and the array) identical.

> **Note:** keeping edge identity stable is not enough if nodes arrive without
> `measured`. `adoptUserNodes` in `@xyflow/system` calls `parseHandles`, which
> discards `handleBounds` when `userNode.measured` is absent. Without
> `handleBounds`, `getEdgePosition` returns `null` and every edge unmounts.
> The fix is in `useLocalNodes.ts` (`shouldDiscardLocalNodes` +
> `withLocalMeasured`): `measured` must survive any node array replacement,
> including the discard path for undo/redo.

### 5b. Context values every node or edge reads keep their identity

A context consumed by every node or edge re-renders all of them when its value
changes identity — `memo` does not help. Derive it so the identity moves only
when its content does (`useStableSetByContent`, `useRevealedLabelEdgeIds`), and
hand React Flow handlers through `useStableCallback`. Measured on the 657-node
fixture: one arrow-key nudge re-rendered all 711 edges (a fresh `Set` in
`EdgeLabelRevealContext`) and every node (a new `onNodeClick`) before this rule.
To check a change, count renders on a production build with `npm run perf:large`
(`nudge` scenario) rather than trusting `memo`.

### 5c. Edges are culled by their drawn route, in one selector

`DiagramSurface` hands React Flow only the edges whose route box (both endpoint
node boxes plus every stored corner) reaches the viewport grown by one viewport
(`edges/culling/`). Do not switch on React Flow's `onlyRenderVisibleElements`
instead: it judges an edge by its endpoints, so long cross-panel edges never
cull and detoured ones vanish while on screen. Do not stamp the route box on
`edge.data` either — every edge on a moving node would get new `data` per
frame. Anything that acts on edges (select all, delete, export) reads the store
or React Flow's nodes, never the culled array; selected edges and the playback
step are always kept.

### 5d. Far zoom draws less, decided once per canvas

`CanvasLodSync` is the only zoom subscriber for the level of detail: it writes
`data-lod` on the React Flow wrapper and the `CanvasLodContext` value, which
changes once per threshold crossing. Below it, edges nothing points at render
`FarEdge` (stroke, arrowheads, click target — no editing hooks, label or line
hops), and node secondary content marked `data-lod-secondary` is hidden with
`visibility`. Never hide node content with `display`: the node would change
size, React Flow would re-measure it and every edge on it would move.

Panels and API groups mark the element that blurs what is behind them
`data-canvas-blur`, and at far zoom the stylesheet turns that `backdrop-filter`
off (`index.css`); the translucent fill stays. A backdrop filter makes the
compositor re-layerize the canvas on every frame that paints, and it is a cost
no profile of script shows: 1000 nodes at fit view (zoom 0.11, 40 panels), 30
wheel ticks went from about 20 long tasks / 1.2–1.3 s, with 1.7–2.9 s of
`Layerize` in the trace, to none. A node renderer that adds a `backdrop-blur`
must mark it (`nodes/canvasBlur.guard.test.ts`).

At full zoom the blur stays at rest and is off only while the viewport moves:
`ViewportGestureSync` (inside `<ReactFlow>`, `core/`) writes
`data-viewport-moving` on the wrapper from React Flow's viewport start/end and
clears it 200 ms after the last movement — a wheel pan reports a start and an
end on every tick, and clearing it at once toggled the filter 60 times in 30
ticks, which cost more than the blur. Measured at 1000 nodes, zoom 0.71–0.73,
9–12 panels on screen: 30 wheel ticks 6 long tasks / ~415 ms → none (frame
p95 34–50 → 25 ms). Node drags keep the blur: removing it during a drag
measured within noise (one node: 2 long tasks either way, ~205 → ~180 ms;
twelve nodes: no difference). Do not keep the blur with
compositing hints instead (`will-change` on the node or edge layers): each one
measured changed the stacking order — panels over edges, or 470–1271 layers.

### 5e. The minimap follows a drag five times a second

React Flow's `<MiniMap>` subscribes to React Flow's store itself: every drag
frame it recomputes the bounds of all nodes, runs one selector per node and
redraws every moved rectangle — all of them when the whole selection moves.
`DragThrottledMiniMap` (`components/`) renders the same `<MiniMap>` inside its
own `ReactFlowProvider` whose store mirrors the canvas store (it is handed the
canvas state object as is). At rest every change reaches the mirror at once, so
panning, zooming and clicking the minimap behave as before; while a node drag
is in progress (`dragActivity`, started and stopped by the canvas drag
handlers) the mirror is refreshed every `MINIMAP_DRAG_REFRESH_MS` (200 ms) and
once more when the drag ends. Measured dragging all 1000 nodes at fit view:
minimap attribute writes per gesture −65 % (31 686 → 11 226 at 400 nodes), long
tasks ~4.9 s → ~4.6 s, the same as with the minimap switched off. Do not hand
the minimap the live store again, and do not put `dragging` on React state in
`Canvas` to drive it: the drag frames bypass `Canvas` renders on purpose.

### 6. Do not subscribe per entity to a canvas-wide value

A selector that returns the same canvas-wide flag (`elementsSelectable`,
viewport size, “is anyone in view”) is cheap **once**. It is expensive
when every node or every edge runs it on every RF / Zustand notification.

| Do | Don't |
| --- | --- |
| Read canvas-wide flags once (Canvas / context / descriptor context) | `useStore` / `useDiagramStore` inside `EditableEdge` or a node renderer for a value identical for every instance |
| Put per-entity data on `node.data` / `edge.data` via descriptors | New store subscriptions inside node/edge components |

See [rendering-pipeline.md](./rendering-pipeline.md): node components are
dumb renderers of `data`. New state goes on `buildData`, not a hook in the
component.

---

## How to check a change

Before merging canvas / store / collab work that runs during drag or on
every `set()`:

1. Does anything new mount **per node or per edge** and call `useStore`,
   `useReactFlow`, `querySelector`, or a Zustand selector?
2. Does a drag-frame path walk `nodes` / `edges` / `components`?
3. Did a callback passed to `<ReactFlow>` gain a dependency that changes
   every frame?
4. Does one pointer gesture call `set()` more than once?
5. After a store write that touches one entity, do unchanged RF node/edge
   objects keep their identity?

If yes to 1–4 or no to 5, stop and reuse a strategy above.

---

## Remaining opportunities (future work)

Ranked by where they fire and how closely they match a strategy already
proven. None of these are required to keep current FPS; they are the next
places to look.

The four "High" items this list used to open with are done; they are in
"Already in place" below with the tests that lock them. Rechecked on
2026-11-05 against the 657-node fixture (`npm run perf:large`): what is left
here costs little on that diagram.

### Medium

| Opportunity | Strategy | Where | Why |
| --- | --- | --- | --- |
| Treat `NodeToolbar` like edge labels | §1 | `NodeQuickActionsBar`, `PendingNodeToolbar` | Same RF portal/subscriber family. One instance is fine; N pending LLM toolbars scale with preview count |
| Skip occupancy math until the boolean can flip | §2 / §6 | `useViewportOccupancy.ts` | Equality stops the **re-render**, not the O(N) `nodeLookup` scan on every RF notification — about 20 µs per frame at 657 nodes |
| Reuse the gesture panel index on **commit** | §2 | `useNodeDragParenting` `onNodeDragStop` still calls `findPanelContainingPoint` | Frames are O(1); multi-select commit is still O(S × N) |
| Identity-cache `edgeHandleAssignments` | §5 | `useCanvasConnectionDerivations.ts` | A new array reference rebuilds the `useCanvasEdges` memo even when most assignments are unchanged |

### Lower / situational

| Opportunity | When it matters |
| --- | --- |
| `useCanvasNodes` still rebuilds `childrenIndex`, sorts `visibleComponents`, scans locks on every `dataCtx` change | Panel-target highlight during drag, selection, compare, flow |
| `flowBadges` / `coverage` new object graphs | Flow panel / playback — invalidates node+edge memos |
| `useConnection` / `useEdgeControlPoints` per edge | Store writes (edge edit, commit), not node-drag frames |
| `useConnectionInternalsSync` key-diff | Connect / disconnect only |

---

## Already in place (do not “simplify” these away)

| Piece | Locked by |
| --- | --- |
| Single `EdgeLabelPortalHost` | `EdgeLabelPortal.test.tsx` (import walk + shared container) |
| Gesture panel index, O(0) node-list scans after frame 1 | `useNodeDragParenting.hotpath.test.tsx` |
| Stable `onNodesChange` / `onNodeDragStop` via refs | comments + hotpath tests |
| One `batchCommitNodeDrag` / one `batchUpdateNodeLayouts` | `singleCommit` + `dimensionFlush` tests |
| Per-node identity (`useCanvasNodes`) | existing node identity tests |
| Per-edge identity + `shallowEqualRecord` (`useCanvasEdges`) | `useCanvasEdges.identity.test.ts` |
| `HandleHighlightContext` not rebuilt from Canvas render (the provider keys its value on the four fields) | comment in `HandleHighlightProvider` |
| `EdgeLabelRevealContext` keeps its identity while its members are unchanged | `useRevealedLabelEdgeIds.test.ts` |
| Canvas-wide id sets reach nodes and edges as membership (`idSetStore.ts`): handle highlight and revealed labels re-render only the elements that joined or left the set | `idSetStore.test.tsx` |
| What a selection disables on a card is read by its controls (`selection/selectionControls.ts`), not carried on every card's data | `selectionControls.test.tsx`, `CardNode.selectionControls.test.tsx` |
| Edge reconnect anchors are off while nodes are dragged (`useReconnectAnchorsOffWhileDragging`) | `useReconnectAnchorsOffWhileDragging.test.tsx` |
| Stable `onNodeClick` (React Flow's `NodeWrapper` is not memoised: a new identity re-renders every node) | `useCanvasEventHandlers.node-click-identity.test.tsx` |
| Per-node `handleOrder` identity kept while its slots are unchanged | `connectionDerivations.stableHandleOrder.test.ts` |
| Route-aware edge culling, one selector, same array inside a grid cell | `routeCulling.test.ts`, `useRouteCulledEdges.test.tsx` |
| Far level of detail: `FarEdge` on the same path, selected/revealed edges stay full | `EditableEdge.lod.test.tsx`, `canvasLod.test.ts` |
| The minimap reads a store mirror refreshed at most every 200 ms during a node drag (`DragThrottledMiniMap`) | `miniMapDragThrottle.test.ts` |
| Node backdrop blur is off at far zoom and while the viewport moves (`data-canvas-blur`, `ViewportGestureSync`) | `canvasBlur.guard.test.ts`, `ViewportGestureSync.test.tsx` |
| `useDiagramActions` stable slice | `stableSlice.ts` |
| Workspace serialised once per persist flush (`createDeferredJSONStorage`) | `persist.deferred-serialization.test.ts` |
| `EditableEdge` reads `elementsSelectable` from `ElementsSelectableContext`, not one store subscription per edge | `EditableEdge.selectable.test.tsx` |
| Node drag frames go straight to React Flow's `setNodes` (`publishDragFrame`, in `useLocalNodes.ts` / `useCanvasGraphState.ts`) without a `Canvas` render | `useNodeDragParenting.panelSelfDrop.test.tsx` |
| Edge control point, segment and label drags write the store once per gesture | `edge-gesture-writes.test.tsx` |
| An arrangement writes its edges (handle order, route resets, routes, label offsets) in one `set()` (`applyLayoutEdges`, `slices/applyLayoutEdges.test.ts`), and runs ELK in a worker (`layout/elkRunner.ts`) | `applyLayoutEdges.test.ts`, `elkRunner.test.ts` |
| Collaboration presence: per-element selectors returning a peer's stable `user`, so cursor packets re-render no node | `usePeerOnNode.test.tsx` |
| One viewport write per pan/zoom gesture, flushed before any read (`useSettledViewportWrite`) | `useSettledViewportWrite.test.ts`, `update-viewport.test.ts` |

`useLocalNodes` itself is a sharp edge (`AGENTS.md`): the local copy during
drag is deliberate. Drag frames already skip its `setTick`; changing how the
rest notifies React is a performance project, not a cleanup.
