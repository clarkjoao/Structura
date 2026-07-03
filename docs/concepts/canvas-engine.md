# Canvas Engine

The canvas (`src/features/canvas/`) turns the diagram model into an
interactive surface. It is built **on** React Flow (`@xyflow/react` v12) but
deliberately wraps it: no other feature imports React Flow, and the canvas
itself does not know what any component *means*.

## Responsibilities

The canvas owns:

- Translating model state → React Flow nodes/edges (via descriptors — see
  [node-system.md](node-system.md), [edge-system.md](edge-system.md)).
- Interaction: selection, drag, resize, connect, panel parenting, keyboard.
- Canvas chrome: toolbar, element picker, inspector panels (`ElementPanel`),
  context menus.
- Mode overlays: flow recording/playback, compare mode, focus mode,
  collaboration presence.

The canvas must **not** own:

- Business semantics ("a container may not contain a person") — that is model
  validation.
- Persistence or interchange.
- Anything reachable without a canvas mounted (dashboard, model explorer).

## Hook architecture

`useCanvasController.ts` composes the per-concern hooks; each hook has one
job (this is composition over inheritance applied to hooks):

| Hook | Concern |
| --- | --- |
| `useCanvasGraphState` / `useCanvasNodes` / `useCanvasEdges` | Build RF nodes/edges from the store via descriptors |
| `useLocalNodes` | **Sharp edge.** Local node copy during drags, merged back on settle — a deliberate performance trade with tests. Don't refactor casually. |
| `useNodeDragParenting` / `usePanelChildLayout` | Panel containment: drag-target detection, unparent candidates, child layout |
| `useCanvasEventHandlers` / `useCanvasInteraction` / `useCanvasKeyboard` | RF event → store action translation, input profiles, shortcuts |
| `useCanvasFlowState` | Flow recording/playback state feeding descriptor context |
| `useCanvasCompareMode*` | Scene compare visuals |
| `useCanvasDiagramNavigation` / `useCanvasDrillHandlers` | Drill-down and cross-diagram navigation |

## Why React Flow, and why behind an abstraction

React Flow provides the hard parts (viewport math, node virtualization, edge
routing primitives, handle system) with a React-native API. The wrapping
discipline exists because:

1. The **descriptor layer** means React Flow's node contract appears in
   exactly one place; a renderer swap would be expensive but bounded.
2. Canvas-agnostic features (viewer, previews, exports) must not pay React
   Flow's costs — `lib/diagram-preview` renders SVG previews with no React
   Flow at all, which is proof the boundary holds.

Recorded as [ADR-0001](../adr/0001-react-flow.md).

## Domain-agnosticism in practice

The canvas never switches on `ComponentType`. When node behavior varies by
type, the variation lives in a `NodeTypeDescriptor` (rendering, z-index,
parenting capability, data building). When you find yourself writing
`if (component.type === …)` inside a canvas hook, move that decision into a
descriptor field instead — that is the "registries over conditionals"
principle, and it is what will let plugins contribute node types without
forking the canvas.

Known residual violations (tracked, to be absorbed into descriptors):
swimlane special-case in `resolveNodeDescriptor`, and assorted
panel-awareness inside drag hooks (`panelIds` in `NodeBuildContext` is the
sanctioned mechanism).
