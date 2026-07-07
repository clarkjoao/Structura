---
name: polish-editable-edge-ux
description: "Improve editable edge UX: corner handles, grid snapping, fluid shaping"
metadata:
  type: change
  status: proposed
---

# Polish Editable Edge UX

## Motivation

The editable-edge system (built in `rebuild-editable-edges`) supports orthogonal
(`EditableStep`) and curved (`Editable`) shapes, but shaping connections feels
clunky compared to draw.io. Drag targets are small, snapping is absent, and
corner placement lacks visual feedback. This change makes edge shaping feel
fluid and precise.

## Proposal

### 1. Corner Drag Handles

Currently, orthogonal edges (`EditableStep`) show segment handles (`EdgeSegmentHandles`)
at the midpoint of each segment. These are small (8px) and easy to miss.

**Add dedicated corner handles** — circular handles (10px diameter) at each vertex
where orthogonal segments meet. These are easier to grab and make corner
placement intentional.

```tsx
// src/features/canvas/edges/components/CornerHandle.tsx
interface CornerHandleProps {
  x: number;
  y: number;
  cornerIndex: number;
  onDragStart: (index: number, e: PointerEvent) => void;
  isActive: boolean;
}

// Visual: filled circle, stroke, hover scale 1.2x
// Positioned at vertex points from buildStepSegments
// Cursor: grab → grabbing on drag
// Min size 10px, touch target 20px (accessibility)
```

**Render logic** in `EditableEdge.tsx`:

- Iterate `stepSegments` vertices (where direction changes: horizontal ↔ vertical)
- Render `CornerHandle` at each vertex
- Hide when edge is read-only or label is being dragged

### 2. Grid Snapping

Edges currently snap to grid only on explicit drags via `useControlPoints.ts` /
`useSegmentDrag.ts`. This feels inconsistent — midpoints and corners should snap
whenever they're being moved.

**Unified snapping** in both hooks:

```ts
// Shared utility: snapToGrid(x: number, y: number, gridSize: number)
function snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}
```

Apply snapping to:

- Control point drags (`useControlPoints.ts`: `handleDrag`)
- Segment drags (`useSegmentDrag.ts`: `computeSegmentDrag`)
- **New**: midpoint drags (ghost midpoints during orthogonal drag)
- **New**: corner handle drags

Config: read grid size from canvas zoom (already stored). Snap threshold:
if pointer is within 8px of a grid line, snap. Else free-form.

### 3. Improved Visual Feedback

**Hover states** — segment handles and corner handles show fill on hover, not just
cursor change.

```tsx
// ControlPoint.tsx: add hover fill
// EdgeSegmentHandles.tsx: add hover fill
// CornerHandle: always show fill on hover
```

**Active segment highlight** — when dragging a segment, dim all other segments
(opacity 0.4) so the active one stands out.

**Preview path while dragging** — show a dashed preview of the new path
before committing. This is already partially done for segment drags; extend to
corner drags.

### 4. Interaction Polish

**Minimum segment length** — don't allow segments shorter than 8px. When dragging
would collapse a segment below this threshold, clamp to 8px and indicate visually
(the segment flashes red briefly).

**Edge endpoint magnetism** — when dragging a corner or segment end within 12px
of a node port, show a magnetic snap indicator (small dot + connecting line)
and snap to the port. Already partially exists for reconnect; extend to corners.

**Keyboard accessibility** — Arrow keys nudge selected control points / corners
by 1px (Shift+Arrow by 10px). Escape cancels drag and restores previous state.

## Files to Change

| File                                                          | Change                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| `src/features/canvas/edges/components/CornerHandle.tsx`       | **New** — corner drag handle component                  |
| `src/features/canvas/edges/EditableEdge.tsx`                  | Add CornerHandle rendering for `EditableStep`           |
| `src/features/canvas/edges/interaction/useControlPoints.ts`   | Apply `snapToGrid`                                      |
| `src/features/canvas/edges/interaction/useSegmentDrag.ts`     | Apply `snapToGrid`, clamp min length, segment highlight |
| `src/features/canvas/edges/geometry/orthogonal.ts`            | Add `snapToGrid` utility                                |
| `src/features/canvas/edges/components/ControlPoint.tsx`       | Add hover fill                                          |
| `src/features/canvas/edges/components/EdgeSegmentHandles.tsx` | Add hover fill                                          |
| `src/features/canvas/edges/styles/editable-edges.module.css`  | Add hover/active states, highlight styles               |
| `src/features/canvas/edges/index.ts`                          | Export CornerHandle                                     |

## Acceptance Criteria

- [ ] Corner handles appear at orthogonal vertices and are draggable
- [ ] All edge drags snap to grid when within 8px threshold
- [ ] Hover states visible on all handles
- [ ] Active segment dims others during drag
- [ ] Minimum segment length enforced (8px floor)
- [ ] Arrow key nudge works for selected handles
- [ ] No regression in existing editable edge interactions
