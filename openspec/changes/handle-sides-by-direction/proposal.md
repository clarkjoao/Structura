# Proposal

## Why

ADR-0013 (Proposed) records the decision that a diagram declares its reading direction,
left-to-right or top-to-bottom. Its rollout starts with a refactor that changes no behaviour.
Today 12 node files hard-code `Position.Left` for input and `Position.Right` for output. That
has to become one function of the reading direction before a top-to-bottom diagram can exist.
Done first and on its own, the refactor is reviewable without the much larger axis work riding
on it.

## What Changes

- A pure, leaf `handleSides(direction)` (in `nodes/node-types/handle-sides.ts`) returns the input, output and cross-axis sides for a
  reading direction. For `"LR"`, the only direction any diagram has today, it returns exactly
  the current sides: left in, right out, top/bottom for the flowchart cross axis.
- A `ReadingDirectionContext` hands the direction to node renderers. It defaults to `"LR"`, and
  no provider sets anything else yet.
- Every node renderer reads its handle sides through `useHandleSides()` instead of naming
  `Position.Left` / `Position.Right` / `Position.Top` / `Position.Bottom`.
- The shared handle builders spread their slots along the side's axis: `top` offsets for a left
  or right side (unchanged), `left` offsets for a top or bottom side, using the same formula. The
  bundle dot follows the side.
- `SkinHandles` and the flowchart shapes take their anchor points per side, so the caller says
  which outline point belongs to which side.

## Non-Goals

- Any top-to-bottom behaviour: the `Diagram.direction` field, the provider that sets `"TB"`,
  the layout per axis, the route readers, edge geometry, exports, collaboration. These are later
  steps of ADR-0013.
- Changing `connectionDerivations`: which handle an edge uses stays where it is.
- Skinned elements' top/bottom outline points, which only a top-to-bottom diagram needs.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none). This is a pure refactor with no spec-level behaviour change (`skip_specs: true`).

## Impact

- New: `src/features/canvas/nodes/node-types/handle-sides.ts` and
  `src/features/canvas/contexts/ReadingDirectionContext.tsx`.
- Changed: `nodes/CardNode/Handles.tsx`, `nodes/CardNode/index.tsx`, `nodes/PanelNode.tsx`,
  `nodes/NoteNode.tsx`, `nodes/DbTableNode/DbTableNode.tsx`,
  `nodes/JsonViewerNode/JsonViewerNode.tsx`, `nodes/EndpointNode.tsx`,
  `nodes/ExternalElementNode.tsx`, `nodes/SvgNode.tsx`, `nodes/DeployNodes/DeployParts.tsx`,
  `nodes/ProcessNode/index.tsx`, `nodes/skin/SkinHandles.tsx` and its callers.
- Tests: the existing node, handle and `connectionDerivations.fixedSides` suites must pass
  unchanged; new unit tests cover `handleSides` and the builders' per-axis slot placement.
