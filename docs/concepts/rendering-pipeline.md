# Rendering Pipeline

How a `Component` in the store becomes pixels, and where each concern is
allowed to live.

## The pipeline

```
store (Diagram.snapshot + nodeLayouts, scenes, flow state, selection, …)
  │  selectors
  ▼
NodeBuildContext        one shared context per render pass
  │
  ▼
resolveNodeDescriptor(component)          ← registry lookup, ordered match
  │
  ├─ descriptor.buildData(comp, ctx)      → RF node `data`
  ├─ descriptor.buildStyle?(comp, ctx)    → RF node `style` (size, dimming, …)
  └─ descriptor flags                     → type, zIndex, draggable, parenting
  ▼
React Flow node objects  ──►  useLocalNodes (drag-time local copy)
  ▼
<ReactFlow nodeTypes={registry map} … />  → node React components render
```

Edges follow the same shape through `useCanvasEdges` and `CustomEdge`
(see [edge-system.md](edge-system.md)).

## Stage responsibilities

1. **Selectors** decide *what is visible*: active scene resolution
   (scene diffs applied over the snapshot), hidden components filtered,
   effective layouts resolved. Nothing downstream re-derives visibility.
2. **`NodeBuildContext`** is assembled once per pass by `useCanvasNodes` and
   carries everything descriptors may need: resolved components/layouts,
   selection, flow highlight/recording state, compare visuals, service
   registry, connection counts, handle order, callbacks (drill-down, collapse,
   inline edit). It is intentionally broad — descriptors depend on canvas
   *state*, never on canvas *internals*.
3. **Descriptors** decide *how a component renders*: which React component,
   what data/style it gets, stacking, parenting flags. All per-type policy
   concentrates here.
4. **`useLocalNodes`** decouples drag frames from store round-trips: during a
   drag, positions update in local state at frame rate; on settle they commit
   to the store (one history entry). This is the pipeline's one intentional
   impurity, and it has tests guarding its merge behavior.
5. **Node components** (`features/canvas/nodes/*`) are dumb renderers of
   their `data` payload. They do not read the store directly; if a node needs
   more state, widen `buildData`, don't add a store subscription inside the
   node. (A few legacy nodes still violate this; treat them as debt, not
   precedent.)

## Performance rules that shape the design

- **Referential stability is the contract.** `useStableListByRefEquality`
  and careful memoization keep unchanged nodes referentially identical so
  React Flow skips re-rendering them. `buildData` must not fabricate new
  object identities for unchanged inputs where avoidable.
- Drag never round-trips the store per frame (`useLocalNodes`).
- Undo history snapshots the model, not RF nodes — rendering state is always
  reconstructable, never persisted.
- Cypress `stress-*` specs are the regression net for all of the above.

## Static rendering (no React Flow)

`lib/diagram-preview/generatePreviewSvg.ts` renders diagram previews as plain
SVG with a cache, used by the dashboard. It exists to keep list views cheap,
and doubles as proof that the model is renderer-independent. Exporters
(draw.io, Mermaid) are likewise model-to-text transformations that never
touch the canvas.
