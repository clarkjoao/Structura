# Canvas edges

The edge subsystem renders diagram connections as React Flow edges and provides
the editable-edge experience (control points, reconnection, label drag, toolbar)
modelled on the React Flow [editable-edge example](https://reactflow.dev/examples/edges/editable-edge).

A single edge type — `editable`, implemented by `EditableEdge.tsx` — renders
every connection. Two styles are editable:

- `EdgeStyle.Editable` — freely positioned control points drawn as a smooth
  Catmull-Rom curve (drag points, click ghost midpoints to add, double-click to
  remove).
- `EdgeStyle.EditableStep` — orthogonal (draw.io-style) routing with sharp
  right-angle corners; drag a **segment** perpendicular to reposition it, drag a
  **corner** handle directly, double-click a corner to remove it, or click a
  segment's midpoint ghost to add a bend. Corners are materialized as control
  points and the route stays orthogonal.

Editing gestures snap to the grid (Alt bypasses) and magnetically to nearby node
alignment lines (left/center/right, top/middle/bottom) with a live guide;
handles can be nudged with the arrow keys (Shift for 1px). The edge toolbar
toggles between curved and orthogonal routing.

All other styles (`bezier`, `smoothstep`, `step`, `straight`) render as
non-editable presets via React Flow's built-in path helpers.

## Layout

| Folder / file                                                                                | Responsibility                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EditableEdge.tsx`                                                                           | Thin composition root: picks the path, wires interaction, renders control points, label, toolbar.                                                                  |
| `geometry/`                                                                                  | Pure, unit-tested math: `paths.ts` (curve), `orthogonal.ts` (step + corner drag, prune, grid snap), `projection.ts`, `alignment.ts` (node magnet lines). No React. |
| `interaction/`                                                                               | Pointer→store bridges: `useControlPoints`, `useSegmentDrag`, `useEdgeReconnect`, `useEdgeLabelDrag`, and `snapping.ts` (magnetic alignment + grid, shared).        |
| `components/`                                                                                | Presentational SVG/DOM: `ControlPoint`, `EdgeSegmentHandles`, `EdgeHitArea`, `EdgeToolbar`, `EdgeLabel`.                                                           |
| `overlays/`                                                                                  | Non-editing overlays rendered independently: `EdgeParticle`, `EdgePayloadOverlay`, `CollabEdgeHighlight`.                                                          |
| `data/`                                                                                      | `buildEdges.ts` (connection→edge mapper) and `edgeData.types.ts` (`EdgeStyleData` vs `EdgeOverlayData`).                                                           |
| `connectionDerivations.ts`, `useCanvasHandleReorder.ts`, `useCanvasConnectionDerivations.ts` | Handle-slot assignment for node endpoints.                                                                                                                         |
| `useCanvasEdges.ts`                                                                          | Maps visible connections to edges with flow/compare/coverage visuals.                                                                                              |

## Data & state

Control points live in the persisted per-edge layout,
`diagram.edgeLayouts[connectionId] = { points?: EdgeControlPoint[]; pathType?; labelOffset? }`
(see `features/diagram`). Reads go through `useEdgeControlPoints` /
`useEdgeLabelOffset`; writes go through the `setEdgeControlPoints` /
`add`/`remove`/`resetEdgeControlPoints` / `setEdgeLabelOffset` store actions.

Editing mutations record undo history (`edgeLayouts` are captured in history
snapshots). A drag streams position updates with `{ history: false }` after
recording a single checkpoint on the first move, so one gesture is one undo step.

Overlay-only data (flow mode, playback, recording, coverage, collaboration) is
kept out of the editing core so overlay updates never recompute edge geometry.
