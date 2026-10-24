# Design

## Context

See proposal.md and `docs/adr/0013-diagram-reading-direction.md` (decisions 2–4). Two things
about React Flow shape the approach:

- **`Position` values are strings** (`"left"`, `"right"`, `"top"`, `"bottom"`). Code that keys
  anchor points by side can therefore index by the `Position` itself.
- **Each node component positions its own `<Handle>`.** The only shared builders are
  `buildHandles` / `buildPanelHandles` (`CardNode/Handles.tsx`, also used by `DeployParts` and
  `PanelNode`) and `SkinHandles`.

## Goals / Non-Goals

**Goals:**

- Zero behaviour change for `"LR"`. The rendered DOM of every node stays identical.
- One place decides sides; no node file names a `Position` constant for input or output again.

**Non-Goals:**

- See the proposal's Non-Goals.

## Decisions

### 1. `handleSides(direction)` is a pure leaf module next to `handle-spec.ts`

```ts
type ReadingDirection = "LR" | "TB";
interface HandleSides {
  input: Position;
  output: Position;
  crossInput: Position;
  crossOutput: Position;
}
// LR: left, right, top, bottom   TB: top, bottom, left, right
```

It lives in `nodes/node-types/` beside `handle-spec.ts`, imported by renderers and builders. It
is pure, so tests and, later, the non-React readers (layout, export) can use it without the
context. `"TB"` is implemented and unit-tested now, so step 2 does not have to touch this module.

### 2. A context with an `"LR"` default; no provider yet

`ReadingDirectionContext` holds a `ReadingDirection`, and `useHandleSides()` returns the
memoised `handleSides(direction)`.

- The value is a constant string, so no node re-renders because of it.
- With no provider, every node gets `"LR"`, so this step needs no wiring in `Canvas` or the
  viewer.
- Like `LineHopsContext`, the provider will have to wrap `<ReactFlow>` when step 2 adds it.

_Alternative considered:_ passing the direction through node data. Rejected because node data
is rebuilt per node per render in the hot path (`docs/concepts/canvas-hot-path.md`), and the
direction is diagram-wide.

### 3. The builders read the axis from the side

- `buildHandles` places slot offsets with `top` when the side is left or right, and with `left`
  when it is top or bottom, using the same `handleTopCss` formula. The function keeps its name,
  because `renderedEdgePath` and the panel-ports test measure against it; its comment now says it
  is the offset along the side.
- The bundle dot pins itself to the middle of its side through `middleOfSideStyle(side)`, which
  lives in `handle-sides.ts`. A `switch` over sides is not a choice of side, so it belongs with
  the side model, and the guard test stays strict.

### 4. Anchor points are keyed by side

- **`SkinHandles`** takes `input` / `output` points instead of `left` / `right`. Its callers pass
  the same points they pass today.
- **`ProcessNode`** already computes `at.left/right/top/bottom`. It indexes them with the side
  from `useHandleSides()`, so each handle keeps its point, and `pct`/`inert` styling is
  unchanged.

## Risks / Trade-offs

- **[Risk]** A renderer missed in the sweep keeps a hard-coded side. → A test greps the node
  sources for `Position.Left`, `Position.Right`, `Position.Top` and `Position.Bottom` used
  outside `handle-sides.ts`, and fails on any hit.
- **[Trade-off]** `SkinHandles` callers still compute only left/right outline points, so a
  skinned element in a top-to-bottom diagram would put its top handle at a left point. → That
  wiring belongs to step 2 and is listed there; no `"TB"` diagram can exist until then.
