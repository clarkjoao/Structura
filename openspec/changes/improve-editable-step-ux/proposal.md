## Why

The current `EdgeStyle.EditableStep` implementation provides only basic orthogonal segment dragging with no visual feedback affordances: no corner handles, no grid snapping, no live preview during drag, and no visual distinction between the route being dragged and its final resting position. The UX feels incomplete compared to the draw.io reference and the smooth curve editing in `EdgeStyle.Editable`. Corners materialize as control points after dragging but are never directly manipulable, and segment repositioning has no alignment assistance. This change upgrades `EditableStep` to match the quality of the editable curve UX.

## What Changes

- **Corner drag handles**: Add visible corner control points for step edges that can be dragged directly, not just inferred after segment drags. Corners update the adjacent segments in real time.
- **Grid snapping during drag**: Snap segment drags and corner drags to the canvas grid when enabled, providing alignment assistance. Add a visual snap indicator.
- **Live drag preview**: Show a semi-transparent preview of the new path during drag, replacing the static highlight-only feedback of `EdgeSegmentHandles`.
- **Minimum segment length guard**: Prevent segments from collapsing to zero length or inverting, keeping the route valid.
- **Improved segment handle UX**: Add corner radius markers at segment endpoints to hint at valid drag directions, and improve the hit area/hover states.
- **Persist corner positions**: After dragging a corner directly, its position is stored as a control point, matching the behavior of segment drags.

## Capabilities

### New Capabilities

- `editable-step-corners`: Direct corner manipulation — visible corner handles on selected/hovered step edges, drag to reposition, persist as control points.
- `step-edge-grid-snap`: Grid snapping during orthogonal segment and corner drags, with visual feedback.
- `step-edge-drag-preview`: Live semi-transparent preview of the edge path during segment/corner drag.

### Modified Capabilities

- `editable-edges`: The orthogonal step editing requirement (`editable-edges/spec.md` Requirement: Orthogonal step editing) is extended to include corner handles and grid snapping. A delta spec file will be added.

## Impact

- **`geometry/orthogonal.ts`**: Add `computeCornerDrag()` pure function mirroring `computeSegmentDrag()` but for corner repositioning; add `clampSegmentLength()` guard; add grid-snap helpers.
- **`useSegmentDrag.ts`**: Add `startCornerDrag` callback; integrate grid snapping during segment/corner drag; add drag-preview state; emit preview path during drag.
- **`EdgeSegmentHandles.tsx`**: Render corner handles (small squares at corner positions) in addition to segment handles; add preview path rendering during active drag.
- **`EditableEdge.tsx`**: Render corner handles when step edge is selected/hovered; render drag preview overlay.
- **Diagram store (`features/diagram`)**: No schema changes — corners are already stored as control points.
- **Tests**: Add unit tests for `computeCornerDrag()` and `clampSegmentLength()`; update integration tests for the new handles.
- **Dependencies**: none added.

## Non-Goals

- Not adding multi-segment insertion/deletion (e.g., adding a new bend in the middle of an existing segment) — only repositioning existing corners and segments.
- Not adding orthogonal-aware routing suggestions when an edge is first created (auto-routing is a separate concern).
- Not adding keyboard nudging for corners (future work).
- Not changing the `editable` (Catmull-Rom curve) style — orthogonal improvements are scoped to `EditableStep` only.
