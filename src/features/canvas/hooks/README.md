# canvas/hooks

This directory is the control layer for the canvas feature. Most hooks here are
private and are composed by [`Canvas.tsx`](../Canvas.tsx) through
`useCanvasController`.

## How the main hooks fit together

1. `useCanvasController` is the top-level orchestrator used by `Canvas.tsx`.
2. `useCanvasStore`, `useCanvasVisualState`, `useCanvasCompareState`, and
   `useCanvasFlowState` gather the state needed to render the canvas.
3. `useCanvasInteraction` wires navigation, events, keyboard shortcuts, drag
   parenting, and side effects.
4. `useCanvasGraphState` turns the current diagram snapshot into React Flow
   `nodes` and `edges`.

## Node selection

Selection is the one piece of canvas state with two writers — the user, through
React Flow, and the app, through panels, menus, shortcuts and URL focus. Getting
it wrong does not throw; it renders a canvas where one node is described in the
panel while a different one keeps the selection ring. Three rules keep it
coherent.

### 1. `useCanvasSelectionStore` is the single source of truth

`selectedNodeIds` is the selection. `selectedNodeId` is the *primary* member of
it. They are one selection stored in two fields because they drive different
visuals:

| Field             | Drives                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `selectedNodeId`  | Element panel contents, `NodeQuickActionsBar` placement, `data.isSelected` on node renderers |
| `selectedNodeIds` | Dimming of everything else (`nodeVisibility.ts`), and the `selected` flag on each node      |

**INVARIANT: `selectedNodeId === null || selectedNodeIds.has(selectedNodeId)`.**
The store enforces this in `setSelectedNodeId` / `setSelectedNodeIds`, so a
caller that updates only one field cannot desynchronize them. Promoting a node
from outside the selection moves the whole selection to it; dropping the primary
out of the selection demotes it to another member. Locked by
`useCanvasSelectionStore.test.ts` — do not weaken those setters into plain
assignments.

### 2. `selected` flows store → nodes → React Flow, never the reverse

`useCanvasNodes` writes `selected: selectedNodeIds.has(id)` and `useLocalNodes`
adopts that value (`sn.selected`) instead of keeping its local one. This is what
makes selections that React Flow never saw — context menu, keyboard, search,
`focusComponentsOnCanvas` — actually move the ring.

Two consequences worth knowing before editing either hook:

- `useLocalNodes` merges **during render**, not in an effect. In an effect the
  merged array would only exist after the render returned, so React Flow would
  paint the previous selection for a frame. It performs no `setState`: React Flow
  reports its own selection back through `onSelectionChange`, so re-rendering
  from inside the merge closes a feedback ring and any disagreement in that ring
  becomes `Maximum update depth exceeded`. The merge is idempotent per
  `storeNodes` identity, which is what makes render-time mutation safe.
- The short-circuit comparison in the equal-length branch must include
  `selected`, otherwise a change that only moves the selection is skipped.

### 3. React Flow owns gestures it already implements

When React Flow has its own behavior for a gesture, let it run and take the
result from `onNodesChange`; do not apply the same change a second time. In
particular `multiSelectionKeyCode` (Ctrl/Cmd) makes React Flow toggle the
clicked node on mousedown and that reaches the store through
`onSelectionFromChanges`, so `onNodeClick` must not toggle again — it would undo
the gesture and make the two sides correct each other in a loop.

For the same reason, writes that report React Flow's selection back to the store
(`onSelectionChange`, `onSelectionFromChanges`) compare content before allocating
a new `Set`: an identity-only write re-renders the canvas and bounces straight
back.

Note that an empty node selection also arrives when React Flow deselects nodes
because an *edge* was clicked. Empty must reach the store — otherwise
`selectedNodeIds` keeps pointing at the previous node — but the surrounding reset
of edge and menu state must not.

## Core orchestration hooks

| Hook                    | Goal                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCanvasController`   | Main composition hook for the canvas. It pulls together store data, local UI state, compare/flow state, graph derivation, and interaction handlers into one object that `Canvas.tsx` can render.            |
| `useCanvasStore`        | Bridges the diagram feature into the canvas. It exposes the active diagram, visible components and connections, service registry, flows, and bound diagram actions with stable references where possible.   |
| `useCanvasGraphState`   | Builds the renderable graph for React Flow. It derives handle assignments, creates canvas nodes and edges, keeps local drag state in sync, and refreshes node internals when connection counts change.      |
| `useCanvasInteraction`  | Collects canvas behaviors that mutate or navigate: drill-down, keyboard shortcuts, React Flow event handlers, drag parenting, save actions, search, sidebar state, and command palette state.               |
| `useCanvasVisualState`  | Owns ephemeral canvas UI state that does not belong in the diagram store: selected node and edge IDs, highlights, context menu state, quick insert state, tag visibility filters, and inline editing state. |
| `useCanvasFlowState`    | Adapts flow playback and recording state for the canvas layer. It combines `useFlowState` with `FlowModeContext` and disables playback visuals while compare mode is active.                                |
| `useCanvasCompareState` | Small composition hook that combines compare-mode derivations with compare-mode side effects, so canvas code can consume one compare-oriented state object.                                                 |
| `useInteractionMode`    | Answers "what is allowed right now?" based on flow mode, compare mode, and collaboration state. It is the policy hook for enabling or disabling editing, navigation, export, and related actions.           |

## Interaction and lifecycle hooks

| Hook                         | Goal                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCanvasEventHandlers`     | Creates the React Flow event handlers for connect, click, selection, double-click, context menu, pane click, and quick insert. It translates raw canvas events into store actions and visual-state updates.                                 |
| `useCanvasEffects`           | Runs canvas-level effects tied to the active diagram and playback state. It performs the initial `fitView`, applies custom wheel pan/zoom behavior, clears selection while playing, and keeps the viewport focused on the active flow step. |
| `useCanvasKeyboard`          | Registers and routes keyboard shortcuts for the canvas. It delegates concrete behavior to the `keyboard/` sub-hooks and guards them based on focus, flow mode, compare mode, and open panels.                                               |
| `useCanvasDrillHandlers`     | Handles drill-down into linked diagrams and collapse or expand actions for collapsible node types. It bridges node-level UI actions to diagram navigation and component updates.                                                            |
| `useNodeDragParenting`       | Handles drag-time parenting and unparenting for panel-based layouts. It tracks candidate parent panels during drag, blocks invalid moves, persists temporary layout updates, and commits final parent changes on drag stop.                 |
| `useLocalNodes`              | Keeps a local React Flow node array responsive while the store catches up. It merges store-driven node updates with drag-in-progress state, filters locked scene moves, and adopts the store's `selected` flag (see [Node selection](#node-selection)).                                    |
| `useCanvasDiagramNavigation` | Manages diagram navigation UI state such as the sidebar, search, and command palette. It also records recently opened diagrams and closes navigation surfaces when flow or compare mode locks navigation.                                   |
| `useConnectionInternalsSync` | Watches per-node connection counts and calls `updateNodeInternals` only for nodes whose handles need to be recomputed. This keeps React Flow handle positions current without refreshing every node.                                        |
| `useWalkthroughViewportSync` | When a walkthrough is actively playing, recenters the viewport on the currently highlighted node so the canvas follows the walkthrough step-by-step.                                                                                        |
| `usePeerOnNode`              | Looks up whether a collaboration peer is currently focused on a given node, allowing the canvas to render presence information on that element.                                                                                             |
| `useStableListByRefEquality` | Returns the previous array reference when each item is referentially unchanged. It is a small render-avoidance helper used to stabilize selector outputs.                                                                                   |

## Keyboard sub-hooks

| Hook                    | Goal                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useUndoRedoShortcuts`  | Handles undo and redo keyboard shortcuts and centralizes the modifier-key logic for history navigation.                                                          |
| `useSelectionShortcuts` | Handles select-all, clear selection, and delete behavior for the current canvas selection.                                                                       |
| `useCopyPasteShortcuts` | Handles copy, paste, duplicate, and Draw.io import flows. It translates keyboard commands into clipboard and insertion actions centered on the current viewport. |
| `useGroupShortcuts`     | Handles grouping selected nodes into a panel and ungrouping a selected panel back into free nodes.                                                               |
| `useRecordingShortcuts` | Restricts Delete and Backspace during flow recording so those keys affect recording steps instead of deleting diagram elements.                                  |

## Edge hooks

| Hook                                                                                                                                    | Goal                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useCanvasConnectionDerivations`                                                                                                        | Computes canvas-only edge metadata from visible components and connections: panel IDs, per-node connection counts, handle assignments, and effective handle order. |
| `useCanvasEdges`                                                                                                                        | Turns visible diagram connections into React Flow edges with the right compare, playback, recording, coverage, tag-filter, and pending-LLM visuals.                |
| `useCanvasHandleReorder`                                                                                                                | Exposes a safe `onReorderHandle` callback that reorders a node's incoming or outgoing handles, while blocking changes during recording, playback, or compare mode. |
| Edge editing hooks live under `edges/interaction/` (`useControlPoints`, `useEdgeReconnect`, `useEdgeLabelDrag`); see `edges/README.md`. |

## Node hooks

| Hook              | Goal                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCanvasNodes`  | Translates resolved diagram components and layouts into React Flow nodes. It layers in selection, compare diffs, flow overlays, drag-parenting affordances, tag filtering, pending LLM previews, and node-type-specific callbacks. |
| `useApiGroupSize` | Re-exports API group sizing constants and computation from the diagram feature so the canvas node implementation can stay aligned with the shared model logic.                                                                     |

## Flow hooks

| Hook                   | Goal                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFlowMode`          | Reads the current flow-mode context, which is the shared source of truth for idle, playback, and recording state inside the canvas subtree.                                |
| `useFlowState`         | Derives read-only canvas flow visuals from the current flow mode and the available flows: playback highlight, coverage, active step, and recording overlays.               |
| `useFlowModePlayback`  | Owns the state transitions for flow playback such as play, exit, next, back, and condition-branch choice.                                                                  |
| `useFlowModeRecording` | Owns the state transitions for flow recording and editing, including recording steps, branch ownership, step mutation helpers, and finalization back into persisted flows. |

## Chat hooks

| Hook                            | Goal                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useLLMChat`                    | Presents the canvas chat UI with diagram-aware context. It syncs chat history to the active diagram and enriches outgoing prompts with both diagram context and structured mentions. |
| `useDiagramContext`             | Serializes the active diagram, resolved snapshot, active scene, metadata, and external links into a text block suitable for LLM prompts.                                             |
| `useMentionSearch`              | Builds and searches the list of mentionable nodes and edges from the active diagram snapshot.                                                                                        |
| `useMentionInput`               | Manages the mention-aware text input model, including picker visibility, parsed mention segments, active mention extraction, and insert/remove behavior.                             |
| `useWalkthroughCanvasHighlight` | Converts walkthrough-player state into the same flow highlight shape used by the canvas flow renderer, so walkthrough playback can reuse canvas highlighting.                        |

## Navigation hooks

| Hook                | Goal                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `useRecentDiagrams` | Reads and writes the lightweight recent-diagram list stored in browser storage for the sidebar and command palette experience. |
