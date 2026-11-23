# Design

## Context

- **Where the band comes from.** The kind contract has `overlay(diagram) → KindOverlay` in flow coordinates: axis, `at`/`depth` across the axis, segments, separators and curve. `kindOverlayFor` memoises it, and `KindOverlayLayer` draws it in a `ViewportPortal`.
- **What it touches.** The band never enters the node list and takes no layout room.
- **Fit view call sites.** Fit view is called in several places, each with its own padding:
  - `useCanvasEffects` (the opening viewport and leaving a reading);
  - `useAutoLayout`;
  - `FlowPanel`;
  - `NothingInViewCard`;
  - the `<Controls>` fit button.
- **The viewer.** It has its own framing (`viewer/components/framing.ts`).
- **The draw.io export.** It goes through `export-service` to `export-core`, which builds mxGraph cells from an export model and knows nothing about kinds.

## Goals / Non-Goals

**Goals:**

- One place decides "the diagram's bounds" for whole-diagram framing.
- Export-core stays kind-agnostic.

**Non-Goals:**

- Changing padding or zoom limits.
- Showing the band in the comparison view.

## Decisions

### 1. A `frameDiagram` helper using `fitBounds`, not a hidden bounds node

`frameDiagram(instance, diagram, options)` computes:

- `getNodesBounds(instance.getNodes())`, joined with the overlay's rectangle (axis "x": from the first segment start to the last segment end along x, from `at` to `at + depth` across);
- then `instance.fitBounds(union, { padding, duration })`, clamped to the same min/max zoom.

Without an overlay it calls `fitView(options)`, so freehand diagrams stay exactly as they are. The `<Controls>` button takes it through `onFitView`.

- _Alternative considered:_ an invisible non-selectable node covering the band, so that every `fitView` includes it for free. Rejected:
  - it leaks into every node consumer (minimap, selection box, auto-layout's `getNodes`, export, collaboration);
  - it breaks the "never an element" rule.

### 2. Opening viewport ordering

The opening fit relies on React Flow holding a `fitView` request until the nodes are measured. `fitBounds` has no such hold. When an overlay exists, the opening fit waits for `useNodesInitialized()` and then calls `fitBounds` with duration 0 inside the same frame as the first paint of the measured nodes.

This keeps the existing "no paint at the default zoom" guarantee. The risk is covered by the Cypress check in the tasks.

### 3. Read-only overlay

`KindOverlayLayer` takes `interactive: boolean`. When it is false, segments render as `div`s, not buttons. The viewer mounts it with the diagram it already holds; `kindOverlayFor` is pure. Viewer framing calls the same bounds union.

### 4. draw.io decorations passed as plain data

`export-service` calls `kindOverlayFor(diagram)`. It maps the result to `ExportDecorations` and passes them to export-core:

- rectangles with label and bounds;
- lines;
- one polyline as a list of points.

Export-core writes them into a separate locked layer (an mxCell with `parent="0"`, at the same level as the default layer) whose name comes in translated.

The curve's points are computed from `curve[].along/value` against the band's `at`/`depth`, the same mapping `KindOverlayLayer` uses. That mapping moves to a shared pure function so both draw the same curve.

- _Alternative considered:_ writing phases as draw.io swimlane containers. Rejected: they would capture the steps as children and change the exported structure.

## Risks / Trade-offs

- **[Risk]** `fitBounds` and `fitView` differ slightly in rounding, so freehand diagrams could open at a different zoom. → **Mitigation:** without an overlay the helper calls `fitView` unchanged, and a test asserts it delegates.
- **[Risk]** The overlay grows when the curve is shown (band depth 96 instead of 36), so the fit zooms out a little more. → Accepted: that is the point.
- **[Risk]** Users may edit the draw.io decoration layer and expect it to round-trip. → **Mitigation:** the layer is locked and named. Import ignores it, because it is plain shapes in a non-default layer, and a test covers that.
