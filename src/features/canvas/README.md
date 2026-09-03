# Canvas Feature

`src/features/canvas` is the React Flow adapter for Structura. It takes the
diagram store's resolved state and turns it into an interactive editing surface
with canvas-specific visuals, navigation, flow playback and recording, compare
mode, and chat overlays.

`[Canvas.tsx](./Canvas.tsx)` is the entry point. In practice, almost all of its
behavior is assembled by `useCanvasController`.

## Mental model

The canvas layer has three jobs:

1. Read resolved diagram state from `src/features/diagram`.
2. Derive React Flow `nodes` and `edges` plus transient UI state.
3. Translate user interaction back into diagram actions.

The main composition path looks like this:

```text
Canvas.tsx
  -> useCanvasController
     -> useCanvasStore
     -> useCanvasVisualState
     -> useCanvasCompareState
     -> useCanvasFlowState
     -> useCanvasInteraction
     -> useCanvasGraphState
        -> useCanvasNodes
        -> useCanvasEdges
```

## Directory guide

| Path          | Responsibility                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Canvas.tsx`  | Mounts React Flow, toolbars, side panels, chat, sidebar, and feature overlays.                                                    |
| `hooks/`      | Canvas orchestration hooks: graph derivation, interaction wiring, visual state, compare state, flow state, and keyboard behavior. |
| `nodes/`      | Node rendering, node descriptors, and node-to-React-Flow transformation.                                                          |
| `edges/`      | Edge rendering, handle assignment, waypoint editing, and label drag behavior.                                                     |
| `flow/`       | Flow playback and recording context plus helpers for highlights, coverage, and recording overlays.                                |
| `toolbar/`    | Top-level canvas actions such as quick insert, search, pattern insertion, and scene controls.                                     |
| `panels/`     | Contextual side panels and editing UIs for nodes, connections, and multiselect.                                                   |
| `navigation/` | Sidebar and recent-diagram navigation helpers.                                                                                    |
| `chat/`       | Diagram-aware chat context, mention search, and mention input parsing.                                                            |
| `contexts/`   | Small React contexts shared by node and edge renderers.                                                                           |
| `models/`     | Canvas-local geometry and parenting helpers used during drag interactions.                                                        |

## Hook guide

The detailed hook catalog lives in [`hooks/README.md`](./hooks/README.md).
That document explains the goal of each canvas hook, grouped by orchestration,
interaction, keyboard, edges, nodes, flow, chat, and navigation.

## Key ideas

- `useCanvasStore` reads scene-aware selectors from the diagram feature rather
  than talking to raw store data directly.
- `useCanvasGraphState` is the point where resolved components and connections
  become React Flow `nodes` and `edges`.
- `useLocalNodes` and `useNodeDragParenting` exist to keep drag interactions
  responsive without losing the source-of-truth store model.
- `FlowModeContext` is the local source of truth for recording and playback
  behavior, while persisted flows still live in the diagram feature.
- Compare mode and flow playback reuse the same node and edge rendering
  pipeline by feeding alternate highlight and opacity metadata into it.
