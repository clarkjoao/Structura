# Edge System

Edges render `Connection`s. The system lives in `src/features/canvas/edges/`
and is currently **less factored than the node system** — that asymmetry is
acknowledged debt, and the planned "edge redesign" roadmap item exists to fix
it.

## Model side

A `Connection` (`features/diagram/model/connection.types.ts`) carries:

- **Semantics:** `label`, `technology`, `description`, `intent`
  (dependency/call/event/data-flow/async-message), `direction`,
  `transportPreset` (sync/async/event/tcp/udp).
- **Style:** `ConnectionStyle` — edge style, color, stroke, markers,
  animation, label position, and **waypoints**.

### Known modeling wrinkle

Waypoints and visual style live on the `Connection` (semantic object), while
nodes keep layout in `nodeLayouts` (view state). `EdgeLayout` exists in
`layout.types.ts` and `Diagram.edgeLayouts` is populated, but the
style-on-connection pattern predates it. Consequence: copying a connection
copies its routing; scenes and future multi-view diagrams can't restyle an
edge per view. The edge redesign spec should migrate visual state to
`edgeLayouts` (with a persistence migration) — do not add *new* visual fields
to `ConnectionStyle` in the meantime.

## Canvas side

- `useCanvasEdges` builds React Flow edges from connections + flow/compare
  state; `connectionDerivations.ts` derives handles, labels, and markers.
- `CustomEdge.tsx` (+ `useCustomEdge`) is the single edge renderer:
  geometry from `edgeGeometry.ts`, segment dragging and waypoint editing via
  `edgeBuilding.ts`, draggable labels (`useLabelDrag`), payload overlays
  (`EdgePayloadOverlay`), and flow-playback particles (`EdgeParticle` on
  `EdgeSvgLayer`).
- Handle reordering (`useCanvasHandleReorder`) lets users control where edges
  attach on a node; the order persists in `Component.handleOrder`.

Unlike nodes, there is **one** edge renderer with internal branching, not a
descriptor registry. That is fine while all edges are "labeled arrows", and
wrong the moment VSM (timeline ladders), Step Functions (choice/parallel
semantics), or Saga (compensation arrows) arrive — which is why the edge
redesign precedes those roadmap items.

## Where edge behavior belongs

- Semantic meaning of a connection (intent, transport) → model + inspector
  panels, never inferred from styling.
- Geometry/routing math → `edgeGeometry.ts` / `edgeBuilding.ts` (pure,
  tested: `edgeBuilding.segment-drag.test.ts`, `reset-edge-waypoints.test.ts`).
- Per-type visuals (future) → an `EdgeTypeDescriptor` registry mirroring the
  node system. Design it in the edge-redesign spec rather than growing more
  branches inside `CustomEdge`.

## Export mapping

`lib/export-service/edge-builder.ts` maps connections (including waypoints
and markers) to draw.io mxGraph edges; Mermaid export flattens them to arrow
syntax. Semantic fields (`intent`, `transportPreset`) currently do not
round-trip through any format — a known loss recorded in
[import-export.md](import-export.md).
