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
never happens “a little” — persist middleware still `JSON.stringify`s the
whole workspace on every `set()`.

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
| Collect every moved node and call `batchCommitNodeDrag` once | `commitNodeDrag` + `updateNodeLayout` per selected node |
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

### High — still on the drag frame or every store write

| Opportunity | Strategy | Where | Why |
| --- | --- | --- | --- |
| Hoist `elementsSelectable` out of `EditableEdge` | §6 | `EditableEdge.tsx` `useStore((s) => s.elementsSelectable)` | One subscriber per visible edge; RF notifies all of them every `setNodes` |
| Stop `useLocalNodes` `setTick` from re-rendering `Canvas` every frame | §3 / local copy | `useLocalNodes.ts` `setTick((t) => t + 1)` | Forces the whole controller / graph-state hook chain each pointermove. The local node array is already in a ref; the tick exists so React notices. A narrower subscription (or RF as the only reader of local positions) would cut that walk |
| Local (or batched) writes while dragging edge control points / label offsets | §4 | `useControlPoints.ts`, `useEdgeLabelDrag.ts`, `useSegmentDrag.ts` | Node drag stays off the store; **edge** edit still `set()`s every pointermove → full persist stringify + collab diff per frame |

### High — collaboration / persist (not node-drag FPS)

| Opportunity | Strategy | Where | Why |
| --- | --- | --- | --- |
| Persist: stringify once per debounce, not per `set()` | §4 | `persist.config.ts` + Zustand `createJSONStorage` | I/O is already debounced 1 s; `JSON.stringify` of the workspace still runs on every `set()`. Edge-point drags and typing pay this today |
| Key collab highlight by element, not by `session` | §5 / §6 | `CollabProvider` `editingComponents` depends on `session`; `useCollabHighlight` / `usePeerOnNode` | Cursor packets rebuild `session` → new Map → every node that reads collab context re-renders, even when `activeElementId` did not change |

### Medium

| Opportunity | Strategy | Where | Why |
| --- | --- | --- | --- |
| Treat `NodeToolbar` like edge labels | §1 | `NodeQuickActionsBar`, `PendingNodeToolbar` | Same RF portal/subscriber family. One instance is fine; N pending LLM toolbars scale with preview count |
| Skip occupancy math until the boolean can flip | §2 / §6 | `useViewportOccupancy.ts` | Equality stops the **re-render**, not the O(N) `nodeLookup` scan on every RF notification |
| Reuse the gesture panel index on **commit** | §2 | `useNodeDragParenting` `onNodeDragStop` still calls `findPanelContainingPoint` | Frames are O(1); multi-select commit is still O(S × N) |
| Identity-cache `edgeHandleAssignments` | §5 | `useCanvasConnectionDerivations.ts` | A new array reference rebuilds the `useCanvasEdges` memo even when most assignments are unchanged |
| Stabilize `usePointerFunnel`'s return object | §3 | `pointerFunnel.ts` | New object every Canvas render; `onNodeClick` depends on `funnel`. Cheap until `setTick` makes Canvas render every frame |

### Lower / situational

| Opportunity | When it matters |
| --- | --- |
| `useCanvasNodes` still rebuilds `childrenIndex`, sorts `visibleComponents`, scans locks on every `dataCtx` change | Panel-target highlight during drag, selection, compare, flow |
| `flowBadges` / `coverage` new object graphs | Flow panel / playback — invalidates node+edge memos |
| `useConnection` / `useEdgeControlPoints` per edge | Store writes (edge edit, commit), not node-drag frames |
| `useConnectionInternalsSync` key-diff | Connect / disconnect only |
| `updateViewport` full persist stringify | Pan/zoom **end**, not every frame |

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
| `HandleHighlightContext` not rebuilt from Canvas render | comment on `Canvas.tsx` |
| `useDiagramActions` stable slice | `stableSlice.ts` |

`useLocalNodes` itself is a sharp edge (`AGENTS.md`): the local copy during
drag is deliberate. Changing how it notifies React (`setTick`) is a
performance project, not a cleanup.
