# Design

## Context

See ADR-0013, which records the decision, and proposal.md. Step 1 left `handleSides(direction)`
and `useHandleSides()` in place, with no provider. The left-to-right layout path is tuned and
locked by baselines:

- `layoutEngine` uses ELK RIGHT with EAST/WEST ports;
- `handleAnchor` puts sources on the right edge, spread along the height;
- `alignElkRouteToHandles` forces H-first stubs;
- `straightenRoutes` and `autoRefs` scoring work on the same route shapes.

## Goals / Non-Goals

**Goals:**

- Top-to-bottom reuses the tuned pipeline instead of forking it.
- Left-to-right stays byte-identical.
- One undo step per direction switch.

**Non-Goals:**

- See the proposal's Non-Goals.

## Decisions

### 1. Top-to-bottom by transposition

Mirroring a diagram across its main diagonal (x↔y, width↔height) turns top-to-bottom into
left-to-right: the top side becomes the left, the bottom becomes the right, and an edge flowing
down becomes one flowing right. So `layout/axis.ts` provides:

- `transposeGraph`, an involution. It swaps node width and height, a container's `topInset`
  with a new `leftInset`, and edge label width and height.
- `transposeResult`. It swaps boxes, routes, label centres and bounds. The handle order is
  unchanged: "top to bottom along the side" in transposed space is "left to right along the
  side" in real space, which is the order `buildHandles` spreads a top or bottom side in.

A top-to-bottom layout is `transposeResult(layoutLR(transposeGraph(graph)))`. Everything
downstream of ELK (handle alignment, straightening, reference scoring, edge layout writing)
runs in transposed space, and only points are transposed back.

The canvas draws a step path H-then-V per knot. A transposed route is V-first, but every
consecutive pair of knots in an orthogonal route shares an axis, so one of the two commands is
a no-op and the drawn shape is identical (the `buildStepPath` comment states this invariant).

_Alternatives considered:_

- **Parameterising each reader by axis.** Rejected: it touches five tuned modules and doubles
  their tests for the same result.
- **ELK DOWN with NORTH/SOUTH ports.** Rejected: it gives a different route shape from the one
  every reader expects.

The engine gains `leftInset`, which pads a container on the left as `topInset` pads it on top.
That is how a panel's header room survives the transposition.

### 2. Where the direction enters the layout path

- `DiagramAutoLayoutInput.direction`. `planDiagramAutoLayout` transposes the graph from
  `fromDiagram`, runs `chooseAutoRefs` + layout in transposed space, and transposes the graph
  and result back for `toAppliedLayouts` / `fitContainersToChildren`, which work in real
  coordinates. The plan keeps `direction`.
- `applyLayoutResultEdges(…, { direction })` computes edge layouts in transposed space. It
  transposes the `waypointOffset` and `positionOverrides` in, and the corners back out.
- `layoutScopedNodes` and `usePanelChildLayout` take the diagram's direction the same way.
- `placeIncrementally` transposes layouts, sizes and its output for top-to-bottom, so "one
  column right" becomes "one row below".

### 3. Stored sides are absolute; the cross axis turns

- `Connection.sourceSide` is `"bottom" | "right"` and `targetSide` is `"top" | "left"`.
- `sidesFromHandles(sourceHandle, targetHandle, direction)` maps the cross-axis handle ids
  (unchanged: `source-bottom`, `target-top`, which now mean "the cross-axis handle") to the
  real side for the direction.
- `buildEdgeHandleAssignments(…, direction)` routes an edge to the cross handle only when its
  stored side equals the direction's cross side and the node declares `verticalSides`.
- A stored `"bottom"` in a top-to-bottom diagram is the main output, so it is not routed to the
  cross handle.

### 4. One provider, in `DiagramSurface`

`DiagramSurface` takes `readingDirection` and wraps `<ReactFlow>` in
`ReadingDirectionContext.Provider`. Both the editor and the viewer pass
`diagram.direction ?? "LR"`.

### 5. The switch: plan first, then one store write

The Arrange menu calls `arrange({ direction })`. `runAutoLayout` plans with the new direction,
then `applyAutoLayout(layouts, autoRefs, { direction })` writes the field after a structural
checkpoint in the same `set()`, and `applyLayoutResultEdges` resets and rewrites every edge's
route (its soft checkpoints coalesce into the structural one). `DiagramSnapshot` gains
`direction`, so undo and redo restore it. The switch is disabled when `useCollab()` reports an
active session.

### 6. Measured (2026-10-23)

`directionReadability.experiment.test.ts` measured the four reference diagrams laid out
top-to-bottom with the left-to-right spacing reused:

| Diagram               | Crossings (LR / TB) | Edge-node and label overlaps | LR width×height | TB width×height |
| --------------------- | ------------------- | ---------------------------- | --------------- | --------------- |
| C4 e-commerce         | 0 / 0               | none                         | 3173×879        | 1311×2215       |
| AWS ECS Fargate       | 3 / 3               | none                         | 4312×1040       | 1430×3165       |
| C4 Context healthcare | 1 / 1               | none                         | 1328×984        | 1566×820        |
| AWS microservices     | 4 / 4               | none                         | 2368×1393       | 2091×1698       |

Crossings and overlaps are identical between the two directions, as the transposition
predicts. No vertical-specific tuning is needed to ship; any future tuning has to beat these
numbers.

## Risks / Trade-offs

- **[Risk]** Spacing tuned for wide cards in columns, used for rows, can read sparse vertically.
  → Accepted for this step. The top-to-bottom readability is measured by a test and recorded.
- **[Risk]** Exports still write left-to-right connection points for a vertical diagram. →
  Step 3, and stated in the proposal.
- **[Trade-off]** Hand-tuned routes are lost on a switch. Undo restores them.
