## Context

The current `EditableStep` edge implementation provides basic orthogonal segment dragging via `useSegmentDrag` and `EdgeSegmentHandles`. When a segment is dragged perpendicular to its orientation, `computeSegmentDrag()` in `geometry/orthogonal.ts` updates the affected corners. Corners materialize as control points but are never directly visible or manipulable. There is no grid snapping, no live drag preview, and the segment handles only show a simple highlight during hover/drag without previewing the resulting path.

The reference UX is draw.io-style orthogonal editing: corners are directly draggable squares at each bend, dragging shows a ghost preview of the new route, and alignment snaps to the canvas grid when enabled.

Constraints:

- Corners are already stored as control points in `EdgeLayout.points` — no schema change needed.
- The existing `computeSegmentDrag()` pure function must be extended or mirrored for corner-specific logic.
- Grid snapping depends on the diagram's `gridSize` and `snapToGrid` state (already exists in the store).
- Drag preview must be a lightweight overlay to avoid recomputing the main edge path.
- All UI strings must go through i18n (en + pt-BR).
- History via `pushHistory` must be coalesced per gesture (checkpoint once at drag start).

## Goals / Non-Goals

**Goals:**

- Add corner handles (visible squares at corner positions) that can be dragged directly.
- Implement grid snapping during segment and corner drags.
- Render a live semi-transparent preview of the edge path during drag.
- Prevent segments from collapsing to zero length during drag.
- Mirror the existing `computeSegmentDrag()` pattern with `computeCornerDrag()` for clarity.

**Non-Goals:**

- Adding multi-segment insertion (splitting a segment in the middle).
- Keyboard nudging for corners (separate change).
- Changing the `editable` Catmull-Rom curve style.
- Modifying the persistence schema (corners are already control points).

## Decisions

### D1 — `computeCornerDrag()` mirrors `computeSegmentDrag()` pattern

Add a new pure function `computeCornerDrag()` in `geometry/orthogonal.ts` that takes a corner index, source, target, current corners, and a delta, and returns the new corners array. The logic mirrors `computeSegmentDrag()` but computes the effect of moving a specific corner rather than a segment.

- **Why:** Keeps the geometry logic pure and testable, consistent with the existing segment approach. Corner drags and segment drags are two manipulation modes of the same underlying route.
- **Alternative rejected:** Modifying `computeSegmentDrag()` to handle both cases — would mix two concerns and make the function harder to reason about. Separate functions with shared helpers is cleaner.

### D2 — Corner handles rendered by a new `CornerHandles` component

Create `components/CornerHandles.tsx` that renders a `<rect>` or `<circle>` handle at each interior corner coordinate. It follows the same visibility rules as `EdgeSegmentHandles` (visible on selected/hovered).

- **Why:** Separation of concerns — segment handles and corner handles have different interaction models (segment is a line hit area, corner is a point hit area). Keeping them in separate components makes each easier to reason about.
- **Alternative rejected:** Adding corner handles to `EdgeSegmentHandles` — would complicate that component's state and make testing harder.

### D3 — Grid snapping via `snapToGrid()` helper

Add a `snapToGrid(point: Point, gridSize: number): Point` pure function that rounds x and y to the nearest grid multiple. Apply it in `useSegmentDrag` after computing the raw delta.

- **Why:** Keeps snapping logic pure and testable. The hook decides when to apply snapping (based on diagram's `snapToGrid` setting), and the pure function handles the math.
- **Alternative rejected:** Inline snapping in the event handler — harder to unit test and couples the math to React.

### D4 — Drag preview as a separate path element in `EditableEdge`

Add a `previewPath` state to `useSegmentDrag` that holds the SVG path string for the current drag position. Render it in `EditableEdge` as a second `<path>` with reduced opacity and accent color, using `pointer-events: none`.

- **Why:** Minimal overhead — a single additional `<path>` element during drag. No separate overlay component needed.
- **Alternative rejected:** Separate overlay component — overkill for a simple preview. The edge component already has the geometry logic.

### D5 — `clampSegmentLength()` guard prevents zero-length segments

Add a pure function that, given a proposed new corner position, checks whether any segment would collapse to zero length and clamps the position to the minimum valid offset.

- **Why:** Prevents invalid orthogonal routes during fast drags. The guard runs on every move event, keeping the preview valid.
- **Alternative rejected:** Allow zero-length segments and filter them on commit — would cause visual glitches during drag and complicate the preview.

## Risks / Trade-offs

- **Corner drag vs segment drag overlap** — When a segment is dragged, the corners update. When a corner is dragged, adjacent segments update. A user might expect these to behave identically but they target different elements. → Mitigation: Clearly distinguish corner handles (squares) from segment handles (line highlights) visually.
- **Grid snapping feels laggy** — Snapping on every move event could feel slower than free-form dragging. → Mitigation: Snap only when the pointer is close to a grid line (within 50% of grid spacing). This gives the snap feel without fighting the pointer on every move.
- **Preview path diverges from committed path** — If `clampSegmentLength()` clamps during the preview, the committed path might differ from what was shown. → Mitigation: Run the same clamping logic during preview so what you see is what you get.

## Migration Plan

This change is additive with no persistence schema change. The implementation lands in sequence:

1. Add `computeCornerDrag()` and `clampSegmentLength()` pure functions with unit tests.
2. Add `CornerHandles` component (corners visible, draggable, but no snapping/preview yet).
3. Wire `startCornerDrag` in `useSegmentDrag`, integrating with existing history checkpointing.
4. Add `snapToGrid()` helper and integrate into `useSegmentDrag` for both segment and corner drags.
5. Add preview path state and rendering in `useSegmentDrag` and `EditableEdge`.
6. Update `EdgeSegmentHandles` with corner radius markers for visual direction hints.
7. Add integration tests for corner drag, grid snap, and preview.

Rollback: revert the feature commits. No persistence migration needed.

## Open Questions

- **Corner handle size**: 8x8px or 10x10px? Match the existing `ControlPoint` size for consistency.
- **Snap threshold**: Fixed at 50% grid spacing or configurable? Start with fixed, expose as setting if needed.
- **Preview opacity**: 50% or 60%? Check accessibility contrast requirements.
- **Minimum segment length**: Absolute pixels or relative to grid size? Start with absolute (e.g., 10px minimum).
