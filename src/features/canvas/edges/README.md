# Canvas edges

The edge subsystem renders diagram connections as React Flow edges and provides
the editable-edge experience (control points, reconnection, label drag, toolbar)
modelled on the React Flow [editable-edge example](https://reactflow.dev/examples/edges/editable-edge).

A single edge type — `editable`, implemented by `EditableEdge.tsx` — renders
every connection. Edges whose `edgeStyle` is `EdgeStyle.Editable` gain freely
positioned control points drawn as a Catmull-Rom curve; all other styles
(`bezier`, `smoothstep`, `step`, `straight`) render as non-editable presets via
React Flow's built-in path helpers.

## Layout

| Folder / file          | Responsibility                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `EditableEdge.tsx`     | Thin composition root: picks the path, wires interaction, renders control points, label, toolbar.       |
| `geometry/`            | Pure, unit-tested path + projection math (`paths.ts`, `projection.ts`). No React.                       |
| `interaction/`         | Pointer→store bridges: `useControlPoints`, `useEdgeReconnect`, `useEdgeLabelDrag`.                       |
| `components/`          | Presentational SVG/DOM: `ControlPoint`, `EdgeHitArea`, `EdgeToolbar`, `EdgeLabel`.                       |
| `overlays/`            | Non-editing overlays rendered independently: `EdgeParticle`, `EdgePayloadOverlay`, `CollabEdgeHighlight`. |
| `data/`                | `buildEdges.ts` (connection→edge mapper) and `edgeData.types.ts` (`EdgeStyleData` vs `EdgeOverlayData`). |
| `connectionDerivations.ts`, `useCanvasHandleReorder.ts`, `useCanvasConnectionDerivations.ts` | Handle-slot assignment for node endpoints. |
| `useCanvasEdges.ts`    | Maps visible connections to edges with flow/compare/coverage visuals.                                   |

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
