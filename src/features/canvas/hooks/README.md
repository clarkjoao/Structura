# canvas/hooks — Canvas hook documentation

All hooks in this directory are private to the canvas feature.
They are not exported via `features/canvas/index.ts`.

---

## useCanvasKeyboard

**File:** `useCanvasKeyboard.ts`

**Purpose:** Registers a global `document` keydown listener that handles all
canvas keyboard shortcuts. Skips when focus is inside an input, textarea, select,
or contentEditable element.

**Params:**

| Param | Type | Description |
|-------|------|-------------|
| `diagram` | `Diagram \| null` | Active diagram; listener is a no-op when `null` |
| `selectedNodeId` | `string \| null` | Last focused node |
| `reactFlowInstance` | `ReactFlowInstance` | Used to read/mutate node selection |
| `reactFlowWrapperRef` | `RefObject<HTMLDivElement>` | Used to calculate paste center position |
| `isRecording` | `boolean` | When true, only Delete/Backspace (recording undo) is handled |
| `onRecordUndo` | `() => void` | Called on Delete/Backspace during recording mode |
| `setSelectedNodeId/Ids/EdgeId` | setters | Clear selection after delete/undo |
| `setContextMenu` | `(v: null) => void` | Closes the context menu on Escape |
| `undo / redo` | actions | Cmd+Z / Shift+Cmd+Z |
| `removeComponent` | action | Delete / Backspace |
| `groupNodes / ungroupNodes` | actions | Cmd+G / Shift+Cmd+G |
| `copyToClipboard / pasteFromClipboard / clearClipboard` | actions | Cmd+C/V/D, Escape |

**Side effects:** Adds/removes a `keydown` listener on `document`. Re-registers whenever
any param in the dependency array changes.

**Shortcuts:**

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

**Internal state:**
- `dragTargetPanelId` — reactive state mirroring `dragTargetRef` for rendering (avoids stale closures)
- `dragTargetRef` — mutable ref for synchronous comparison inside `onNodesChange`
- `unparentCandidatePanelId` — shows the "unparent" warning ring on the panel node

**How it works:**
1. `onNodesChange` intercepts `position` and `dimensions` change events. For `position` changes
   with `dragging: true` it computes absolute coordinates (adding parent offset if parented),
   then finds which panel (if any) the node overlaps.
2. `onNodeDragStop` commits the change: if the node is outside its current parent → unparent
   (convert relative coords to absolute); if the node is inside a new panel → reparent
   (convert absolute coords to relative).

---

## useCanvasNodes

**File:** `useCanvasNodes.ts`

**Purpose:** Derives the ReactFlow `Node[]` array from `visibleComponents` using the
descriptor registry (`getDescriptor`). Memoized — only recomputes when any of its ~15
inputs change.

---

## useCanvasEdges

**File:** `useCanvasEdges.ts`

**Purpose:** Derives the ReactFlow `Edge[]` array from `visibleConnections` with
playback/recording styling applied. Memoized.

---

## useFlowState

**File:** `useFlowState.ts`

**Purpose:** Given `activeFlow` and `currentStep`, computes:
- `isPlaying` — whether playback is active
- `activeStep` — the current `FlowStep`
- `flowHighlight` — which nodes/edges are active, visited, participant, or dimmed
- `recordingInfo` — step badges and last-recorded markers for recording mode
- `coverage` — which flows cover each node/edge (for the coverage overlay)
