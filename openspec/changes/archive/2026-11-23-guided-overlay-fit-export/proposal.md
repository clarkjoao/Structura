# Proposal

## Why

The phase band and the emotion curve sit beside the lanes and take no layout room, so every whole-diagram framing ignores them. "Fit view", the opening viewport and the framing after "Arrange" can leave the band half off-screen. The band also exists only in the editor: a shared or embedded journey, and its draw.io export, lose the phases, even though the phases are the journey's main reading aid.

## What Changes

- Whole-diagram framing includes the kind overlay's bounds. This covers the Fit view control, the opening viewport, the framing after "Arrange" and after leaving a reading, and "Nothing in view → Show all".
- Read-only surfaces (the viewer and embeds) draw the band and the curve, without click selection.
- The draw.io export writes the phases as a header row of labelled cells above the lanes, with dashed separator lines across them. The emotion curve is written as one polyline in the band. These are plain shapes, not diagram elements: re-importing the file yields shapes, not phases.

## Non-Goals

- An image (PNG/SVG) export. The app has none today; this change adds none.
- Exporting the band to Mermaid or JSON. Phases already travel there as data (`section`, `%% phases`, `kindProps`).
- Making the band selectable, movable or editable on the canvas (renaming phases from the band is a later idea).
- Framing that targets a selection or one element (focus, search jump). Those stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `guided-journey-phases`:
  - the band is drawn on read-only surfaces;
  - whole-diagram framing includes it;
  - the draw.io export carries it.

## Impact

- `src/features/canvas`:
  - one shared "frame the diagram" helper used by the fit-view call sites (`useCanvasEffects`, `useAutoLayout`, `FlowPanel`, `NothingInViewCard`, the `<Controls>` fit button through `onFitView`);
  - `KindOverlayLayer` gains a read-only mode.
- `src/features/viewer`: `ViewerCanvas` and its framing mount the overlay read-only and include its bounds.
- `src/lib/export-service` and `src/lib/export-core`:
  - the draw.io export receives the overlay as plain decorations;
  - export-core stays kind-agnostic.
- No data model change and no new dependency.
