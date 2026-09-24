# EdgeLabelRenderer, shallowEqualRecord and useNodeDragParenting

Notes from the canvas performance commits (September 2026):

- `a91147a` — one `EdgeLabelRenderer` per canvas
- `079d0b4` — stable edge identity + `shallowEqualRecord`
- `5c14bb4` / `fb1b40b` / `9e1a22d` — hot path and the drag-parenting commit

Related: [canvas-engine.md](./canvas-engine.md), [node-system.md](./node-system.md),
[canvas-hot-path.md](./canvas-hot-path.md) (rules + remaining opportunities).

---

## 1. What is `EdgeLabelRenderer` and what does it do?

### In React Flow

`<EdgeLabelRenderer>` (from `@xyflow/react`) is the official portal for UI "attached" to edges —
labels, toolbars, highlights — but rendered **outside** the edges' SVG.

It:

1. Subscribes to React Flow's internal store.
2. On every notification, resolves its DOM target with a selector along the lines of
   `domNode?.querySelector('.react-flow__edgelabel-renderer')`.
3. Renders its children into that container (absolutely positioned in the viewport plane, not
   inside the edge path).

Without it, labels and toolbars would be trapped inside the edge SVG (clipping, awkward
`pointer-events`, hard z-index).

### Why Structura does not mount one per edge

Every instance is a subscriber that runs `querySelector` on **every** store notification. During a
drag, `setNodes` notifies the store on every frame.

Before: one renderer per edge (label, toolbar, collab highlight, playback overlay…) → on a diagram
with ~400 nodes / ~439 edges, **~439 `querySelector` calls per frame** (~291 ms of a ~2.1 s
gesture).

### The current pattern: one host, N portals

| Piece                     | Role                                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| `EdgeLabelPortalProvider` | Creates a detached `div` and exposes it through context                  |
| `EdgeLabelPortalHost`     | The only `<EdgeLabelRenderer>` on the canvas; attaches the container to it |
| `EdgeLabelPortal`         | Drop-in for edge components: `createPortal(children, container)`         |

Mounted in `features/canvas/core/DiagramSurface.tsx` (inside `<ReactFlow>`, under the provider).
Consumers: `EdgeLabel`, `EdgeToolbar`, `CollabEdgeHighlight`, the playback overlays in
`EditableEdge`, and so on.

**Rule:** only `EdgeLabelPortal.tsx` imports `EdgeLabelRenderer` from `@xyflow/react`. Everything
else uses `EdgeLabelPortal`. A test walks `features/canvas` and fails if anyone reintroduces the
direct import.

Measured afterwards: ~1.4 `querySelector` calls per frame and ~4.3 ms of self time on the same
fixture.

**Pitfall (already fixed):** the host must attach the container with a **ref callback**, not with
`useEffect([container])`. On first paint `EdgeLabelRenderer` often still returns `null` (React
Flow's `domNode` is not ready yet); later it portals the mount **without** re-rendering the host.
An effect in that case runs once with `mount === null` and never attaches — toolbars and labels end
up in a detached node and disappear. That was **not** an intentional removal of the toolbar.

---

## 2. When and why `shallowEqualRecord`?

Defined **only** in `useCanvasEdges.ts` (a local, non-exported function).

It compares two records by their **own keys** and referential equality of the values (`===`). It
is not a deep equal.

### Why

`buildEdge` allocates new objects on every call (`data`, `style`, `markerEnd`, `markerStart`).
Without stabilizing them:

1. Every edge becomes a new object.
2. React Flow remounts the edge layer.
3. Label portals remount → DOM churn.

A drag commit with 439 edges produced thousands of `childList` mutations from edges and labels
**alone**, without creating or removing a single node.

### When it runs

Inside the `useMemo` of `useCanvasEdges`, **after** `buildEdge`, for every visible connection:

1. Compares the nested objects with the cache (`prevPartsRef`) using `shallowEqualRecord`.
2. If equal → reuses the old reference.
3. `isSameBuiltEdge` can then compare the nested fields by reference.
4. If **every** edge matches the previous array → returns the **same** array (`prevArrayRef`).

This mirrors the identity cache `useCanvasNodes` already had for nodes.

### When it does **not** matter

- During a drag frame: the diagram store does not write, so `useCanvasEdges` does not rebuild
  because of the gesture.
- On the drag **commit** and on any other store `set()`: that is exactly where stable identity
  prevents a mass remount.

If the content of `data` / `style` / markers really changed, `shallowEqualRecord` fails → new
object → new edge (only the ones that changed).

---

## 3. When is `useNodeDragParenting` used — and when not?

### What it does

The **panel containment** hook (parent / unparent) in the editor:

| During the drag                                           | On drop (`onNodeDragStop`)                              |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Detects the panel under the cursor → `dragTargetPanelId` (highlight) | Computes `newParentId` + the relative position |
| Detects leaving the parent → `unparentCandidatePanelId`   | One `batchCommitNodeDrag` for **all** nodes of the gesture |
| Flushes measured dimensions → `batchUpdateNodeLayouts`    | Refuses to make a panel a child of its own descendant   |

It also blocks moves in version mode (`canMoveNodeInSceneMode`), blocks locked nodes and nodes with
a locked ancestor (toast), and skips endpoints on the parenting path.

Gesture index (`GesturePanelIndex`): built **once** on the first frame; later frames are O(1)
lookups (they do not re-filter the node list).

### When it **is** used

Always on the **editable** canvas, through `useCanvasInteraction` → `useCanvasController`:

- `onNodesChange` (position + dimensions)
- `onNodeDragStop`
- `dragTargetPanelId` / `unparentCandidatePanelId` → panel/swimlane descriptors (`isDragTarget`,
  `isUnparentCandidate`)

In other words: whenever the user drags nodes in the editor with `nodesDraggable` on.

### When it does **not** apply (behavior / early return)

The hook **is mounted** in the editor, but the parenting logic **does not act** (or only updates
layout) in these cases:

| Situation                                         | Effect                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Endpoint**                                      | Ignored by drag parenting and drag stop                                                     |
| **Note** (while `dragging`)                       | No parent candidate during the frame                                                        |
| **Locked** / locked ancestor                      | Toast; no layout or parent update                                                           |
| **Version mode** blocks the move                  | Toast / return                                                                              |
| Child dragged **together with its parent panel**  | The child's position is ignored for the frame (the parent moves the group)                  |
| **Viewer** / read-only                            | The hook is **not** mounted; the context forces `dragTargetPanelId` / `unparentCandidatePanelId` to `null` |
| `nodesDraggable={false}` (playback, compare without edit, …) | No drag gesture → parenting never fires                                          |

Real parenting only happens on **drag stop**. Frames only update the highlights and (through
another path) the local position / store layout as appropriate.

---

## 4. Sibling concepts (worth knowing together)

### `useLocalNodes`

A local copy of the nodes **during** the drag so the canvas stays fluid without writing Zustand on
every frame. On settle, it merges back with the store. A sharp edge documented in `AGENTS.md` —
do not refactor it casually.

`useNodeDragParenting` receives `nodes: localNodesRef.current` (the gesture positions), not just
the store snapshot.

### One `set()` per gesture / per measure round

- **Drag commit:** one `batchCommitNodeDrag` (before: up to K+2 writes → several undo checkpoints
  and ~1 s of long tasks on a large diagram).
- **Re-measure (ResizeObserver):** one `batchUpdateNodeLayouts` (no history — a measured size is
  not a user edit).

The dominant cost: every store `set()` serializes the whole workspace in the persist middleware.

### Edge identity ↔ EdgeLabelPortal

The same performance theme at two ends:

1. **One** `EdgeLabelRenderer` → subscribing to the React Flow store during a drag is cheap.
2. **Stable edges** → on commit, labels and portals are not remounted for nothing.

### Left-to-right handles (product contract)

Independent of parenting: an edge leaves on the right and arrives on the left, always. Moving a
node does not rewire sides. See `AGENTS.md` and `connectionDerivations.fixedSides.test.ts`.

---

## Quick mental map

```
Drag frame
  ├─ useLocalNodes          → fluid UI (local React Flow nodes)
  ├─ useNodeDragParenting   → parent/unparent highlight (O(1) index)
  └─ EdgeLabelPortalHost    → 1× querySelector (not N×)

Store write (commit / selection / …)
  ├─ batchCommitNodeDrag / batchUpdateNodeLayouts → 1 set()
  └─ useCanvasEdges + shallowEqualRecord → same Edge objects → portals stay alive
```
