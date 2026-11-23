# Tasks

## 1. Framing

- [x] 1.1 Add the pure `overlayBounds(overlay)` and the curve-point mapping shared with `KindOverlayLayer`. Verify: unit tests for LR and TB bounds, a band with and without the curve, and that the layer still renders the same points (KindOverlayLayer test).
- [x] 1.2 Add `frameDiagram` (fitBounds over the nodes ∪ overlay, delegating to `fitView` without an overlay). Use it in `useCanvasEffects` (opening and reading exit), `useAutoLayout`, `FlowPanel`, `NothingInViewCard` and the `<Controls onFitView>`. Verify:
  - a unit test with a mocked instance shows the delegation without an overlay and the union bounds with one;
  - existing canvas tests pass.
- [x] 1.3 Opening viewport with an overlay: wait for the nodes to be measured, then fit with duration 0. Verify: a Cypress scratch tour opens a phased journey with no saved viewport and checks the band's segment is inside the viewport on the first screenshot. Then click Fit view after panning away and check the same.

## 2. Read-only surfaces

- [x] 2.1 Add `interactive` to `KindOverlayLayer` (divs and no click when false). Mount it in `ViewerCanvas`, and include the overlay bounds in the viewer framing. Verify:
  - a component test shows no button role and no selection on click in read-only mode;
  - a viewer test renders the band for a phased journey and nothing for a freehand one.

## 3. draw.io export

- [x] 3.1 Add `ExportDecorations` to export-core: a locked named layer with rectangles, dashed lines and a polyline. Verify: export-core tests on the produced XML (layer cell, `locked=1`, geometry, dashed style), and that an empty decoration set writes no layer.
- [x] 3.2 Map the guided overlay to decorations in `export-service` (kind mode only), with the layer name through i18n (en and pt-BR). Verify:
  - an export test for a phased journey (2 phase cells, the separators, 1 polyline) and for its freehand twin (no layer);
  - an import test showing the file re-imports with the decorations ignored;
  - the i18n coverage test passes.
- [x] 3.3 Update `docs/concepts/diagram-kinds.md` (Phases: framing, viewer, draw.io). Verify: the docs mention all three, and prettier passes.

## 4. Integration

- [x] 4.1 Run `openspec validate guided-overlay-fit-export`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
