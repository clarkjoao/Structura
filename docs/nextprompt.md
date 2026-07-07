# Next prompt — polish the editable edges (corner drag, grid snapping, UX)

Copy the section below into a new Claude Code session to continue the work. It
assumes the editable-edge system built by the `rebuild-editable-edges` OpenSpec
change is already merged.

---

## Task

Improve the editable-edge UX in Structura so shaping connections feels as fluid
as draw.io. Focus on the orthogonal `EdgeStyle.EditableStep` variant, but keep
the curved `EdgeStyle.Editable` variant consistent where it makes sense. This is
a meaningful feature — start with an OpenSpec change (`/opsx:propose`), then
implement, per `AGENTS.md`.

## What already exists (read these first)

- `src/features/canvas/edges/EditableEdge.tsx` — the single `editable` edge
  component. Branches on `edgeStyle`: `Editable` (Catmull-Rom curve, draggable
  control points + ghost midpoints) vs `EditableStep` (orthogonal, draggable
  segments). Preset styles render read-only.
- `src/features/canvas/edges/geometry/`
  - `paths.ts` — Catmull-Rom / linear path builders (pure, tested).
  - `orthogonal.ts` — `defaultOrthogonalCorners`, `buildStepPath`,
    `buildStepSegments`, `computeSegmentDrag` (pure, tested in `orthogonal.test.ts`).
  - `projection.ts` — offset / closest-point / ghost-midpoint helpers.
- `src/features/canvas/edges/interaction/`
  - `useControlPoints.ts` — add / drag / remove control points (curve).
  - `useSegmentDrag.ts` — drag orthogonal segments (step).
  - `useEdgeLabelDrag.ts`, `useEdgeReconnect.ts`.
- `src/features/canvas/edges/components/` — `ControlPoint.tsx`,
  `EdgeSegmentHandles.tsx`, `EdgeHitArea.tsx`, `EdgeToolbar.tsx`, `EdgeLabel.tsx`.
- Store: control points persist in `diagram.edgeLayouts[connId].points`
  (`EdgeControlPoint = { id, x, y }`). Mutations go through the `layout.slice`
  actions `setEdgeControlPoints` / `add` / `remove` / `resetEdgeControlPoints` /
  `setEdgeLabelOffset`, all with a `{ history?: boolean }` option so a drag
  streams with `history: false` after one check
