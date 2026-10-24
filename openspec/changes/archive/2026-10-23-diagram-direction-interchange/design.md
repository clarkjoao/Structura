# Design

## Context

See proposal.md and ADR-0013 (decision 7). Step 2 put `Diagram.direction`, `handleSides`,
`crossAxisSides`, `layout/axis.ts`, `inDirection`, and `applyLayoutResultEdges({ direction })`
in place.

- **draw.io export.** `edgeSides(leavesBottom, entersTop)` returns the fixed right/left pair,
  or the cross pair. `mapEdge` normalises `exitY` only for a left/right source and `entryX` only
  for a top/bottom target; `resolveAbs` already places a handle on any side with the slot offset
  along it.
- **Mermaid flowchart import.** It parses the header direction and drops it. FlowPanel inserts
  the import, then `layoutScopedNodes`, which already uses the active diagram's direction.
- **Assistant.** It inserts with an LR pre-layout, then either runs `autoLayoutActiveDiagram`
  (empty diagram) or writes LR edge routes (diagram with content).

## Goals / Non-Goals

**Goals:**

- The draw.io golden output is unchanged for left-to-right.
- The direction is written only together with a layout, as one undo step (the rule from
  step 2).

**Non-Goals:**

- See the proposal.

## Decisions

### 1. The export's sides come from the direction; normalisation follows the transposition

- `edgeSides(direction, leavesCross, entersCross)` returns the main pair for the direction
  (right/left, or bottom/top) and swaps in the cross side where the edge asks for it.
- `mapEdge` normalises the coordinate that runs along the side:
  - a source on the direction's main output gets its slot offset along that side (`exitY` for
    left/right, `exitX` for top/bottom);
  - a target on the cross input gets its offset along its side (`entryX` for top/bottom,
    `entryY` for left/right).
- For left-to-right this is exactly today's rule (source right → `exitY`, cross target top →
  `entryX`), so the golden output cannot move. For top-to-bottom it is the same rule mirrored.
- The cross-side check reads `crossAxisSides(direction)`, as the canvas does.

### 2. Sanitising on import, in `normalizeImportedDiagram`

- `direction` is kept only when it is `"TB"`.
- `layoutSettings` goes through `normalizeLayoutSettings` (which slice 1 already wrote for
  untrusted input), and the field is dropped when that returns `undefined`.

### 3. Mermaid: the parser reports the direction, the panel decides

- `parseMermaidFlowchart` returns `direction` and `directionApproximated` (for `BT`/`RL`).
- `FlowPanel` picks the target direction:
  - the header's, when the diagram was empty before the import;
  - the diagram's own otherwise.
- `layoutScopedNodes` takes `direction` + `writeDirection`, and passes
  `applyAutoLayout(…, { direction })` when it writes, so the field and the import's layout are
  one undo step.
- Notices go through `toast.info` with i18n keys.

### 4. The IR carries an optional direction; apply-ir uses the same rule

- `DiagramIR.direction?: IRDirection`. The validator keeps it when it is `"LR"` or `"TB"` and
  drops it otherwise, without raising an issue: a bad direction must not reject a good diagram.
- The prompt schema documents the field.
- `applyIRToDiagram` uses the IR's direction for an empty diagram and the diagram's otherwise:
  - the pre-placement layout runs through `inDirection`;
  - the empty-diagram path calls `autoLayoutActiveDiagram({ offset, direction, writeDirection })`;
  - the path for a diagram with content passes `direction` to `applyLayoutResultEdges`.

## Risks / Trade-offs

- **[Risk]** The model never sets `direction`, because the prompt makes it optional. →
  Acceptable: absent keeps today's behaviour. The prompt says when to use `"TB"`.
- **[Trade-off]** An import into a diagram with content cannot change its direction. Changing
  it would re-arrange the user's work, which an import must not do. The notice explains it.
