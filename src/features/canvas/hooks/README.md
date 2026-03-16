# canvas/hooks — Canvas hook documentation

All hooks in this directory are private to the canvas feature.
They are not exported via `features/canvas/index.ts`.

---

## useCanvasStore

**File:** `useCanvasStore.ts`

**Purpose:** Centralises all Zustand store access for the canvas. Returns memoized
selectors via `useShallow` to avoid unnecessary re-renders.

**Returns:** `{ diagram, visibleComponents, visibleConnections, nodeLayouts, viewport, actions }`

---

## useCanvasVisualState

**File:** `useCanvasVisualState.ts`

**Purpose:** Manages all local visual state: selected node/edge IDs, context menu
position, recording highlights. Does not touch the Zustand store.

**Returns:** selected node/edge state, context menu state, setters.

---

## useCanvasEventHandlers

**File:** `useCanvasEventHandlers.ts`

**Purpose:** Provides ReactFlow event handlers: `onConnect`, `onNodeClick`,
`onEdgeClick`, `onPaneClick`, `onNodeContextMenu`. Calls store actions and updates
visual state accordingly.

---

## useCanvasEffects

**File:** `useCanvasEffects.ts`

**Purpose:** Declarative side-effects tied to canvas lifecycle. Persists viewport
to the store on `onMoveEnd`. Syncs node dimensions back to the store after resize.

---

## useCanvasDrillHandlers

**File:** `useCanvasDrillHandlers.ts`

**Purpose:** Handles drill-down navigation. When a node has `linkedDiagramId` the
"Explorar interior" button calls `openDiagram(linkedDiagramId)` via this hook.

---

## useCanvasKeyboard

**File:** `useCanvasKeyboard.ts`

**Purpose:** Orchestrates all canvas keyboard shortcuts by composing the
specialised sub-hooks in the `keyboard/` subdirectory. Registers a global
`keydown` listener; skips when focus is inside an input/textarea/select/contentEditable.

**Params:**

| Param | Type | Description |
|-------|------|-------------|
| `diagram` | `Diagram \| null` | Active diagram; listener is a no-op when `null` |
| `selectedNodeId` | `string \| null` | Last focused node |
| `reactFlowInstance` | `ReactFlowInstance` | Used to read/mutate node selection |
| `reactFlowWrapperRef` | `RefObject<HTMLDivElement>` | Used to calculate paste center position |
| `isRecording` | `boolean` | When true, only recording shortcuts are active |
| `onRecordUndo` | `() => void` | Called on Delete/Backspace during recording mode |

**Keyboard shortcut map:**

| Key | Action |
|-----|--------|
| `Escape` | Clear selection and clipboard |
| `Cmd+A` | Select all nodes |
| `Delete / Backspace` | Remove selected node(s) |
| `Cmd+C` | Copy selected nodes to clipboard |
| `Cmd+V` | Paste clipboard at canvas center |
| `Cmd+D` | Duplicate selected node(s) |
| `Cmd+Z` | Undo |
| `Shift+Cmd+Z` | Redo |
| `Cmd+G` | Group selected nodes into a panel |
| `Shift+Cmd+G` | Ungroup selected panel |

---

## useNodeDragParenting

**File:** `useNodeDragParenting.ts`

**Purpose:** Manages the logic for dropping a node into or out of a panel during drag.
Tracks hover targets in real time and commits parent assignment on drag stop.

**Params:**

| Param | Type | Description |
|-------|------|-------------|
| `diagram` | `Diagram \| null` | Active diagram; provides `nodeLayouts` and `components` |
| `nodes` | `Node[]` | Current ReactFlow nodes array (for bounds lookup) |
| `updateNodeLayout` | action | Persists the new absolute position after unparenting |
| `setParent` | action | Sets `component.parentId` |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `dragTargetPanelId` | `string \| null` | ID of the panel the dragged node is currently hovering over |
| `unparentCandidatePanelId` | `string \| null` | ID of the parent panel that a child is about to leave |
| `onNodesChange` | `OnNodesChange` | Pass directly to `<ReactFlow onNodesChange={...}>` |
| `onNodeDragStop` | handler | Pass directly to `<ReactFlow onNodeDragStop={...}>` |

**How it works:**
1. `onNodesChange` intercepts `position` change events with `dragging: true`, computes
   absolute coordinates (adding parent offset if parented), then finds which panel (if any)
   the node overlaps.
2. `onNodeDragStop` commits the change: if the node is outside its current parent → unparent
   (convert relative coords to absolute); if the node is inside a new panel → reparent
   (convert absolute coords to relative).

---

## keyboard/ sub-hooks

Sub-hooks consumed by `useCanvasKeyboard`. Each handles one shortcut group.

| File | Shortcuts |
|------|-----------|
| `useUndoRedoShortcuts.ts` | `Cmd+Z`, `Shift+Cmd+Z` |
| `useSelectionShortcuts.ts` | `Cmd+A`, `Escape`, `Delete`, `Backspace` |
| `useCopyPasteShortcuts.ts` | `Cmd+C`, `Cmd+V`, `Cmd+D` |
| `useGroupShortcuts.ts` | `Cmd+G`, `Shift+Cmd+G` |
| `useRecordingShortcuts.ts` | `Delete/Backspace` in recording mode |
| `useQuickAddShortcuts.ts` | Quick-insert element shortcuts |
| `helpers.ts` | Shared key detection utilities |
