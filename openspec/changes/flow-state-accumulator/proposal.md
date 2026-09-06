## Why

The reading's variables panel answers *what exists*. A debugger answers *what just happened*. Every
value in the panel today looks the same whether it was set twelve steps ago or on the line the reader
is standing on, and the single most instructive event in the whole call-stack model — a call ending
and taking its locals with it — happens in total silence: the group is simply gone on the next step.

The authoring side has the same shape of problem, plus a confirmed defect. `FlowScriptList.scopeOf`
folds `getPathToStep(stepId).slice(0, -1)`, so the drop for the frame the step itself closes never
runs. The editor therefore offers keys as readable that the reading, standing on that same step, will
report as defined by nobody. `StepContextEditor`'s docblock promises the panel is "folded exactly as
the reading folds it"; it is not.

## What Changes

- **Fix** the editor's scope so it is the reading's scope: fold the whole path, subtract what the step
  itself introduces. Group it by frame, innermost first, and mark the frame the step closes as leaving.
- **Add** a delta between the step before and the step in hand — introduced, replaced, and gone with a
  frame — derived by folding the path twice and comparing. Nothing stored.
- **Add** two row states the panel lacks: *replaced*, which shows the value that was there, and
  *leaving*, which dims a key one step before the frame holding it closes.
- **Change** the variables panel's order and defaults so the accumulating root comes first and open.
- **Add** keyboard behaviour to the values table: Enter opens the next row, Tab walks the cells, a
  pasted `key: value` block or JSON object becomes rows, an abandoned empty row removes itself.
- **Add** a watch strip: keys the reader pins stay visible across steps, including — especially — when
  the fold no longer holds them, where the strip says *out of scope* rather than hiding them.
- **Add** the life of a pinned key along the walked path: where it was introduced, read, replaced, and
  where it went out with its frame. Derived by folding cumulatively; each mark is a jump.

## Capabilities

### New Capabilities

- `flow-state-delta`: what changed in the running object between one step and the next, and how the
  reading says it — introduced, replaced, leaving, gone with a frame.
- `flow-state-watch`: following one key across a reading, including while it is out of scope, and the
  events in its life along the path already walked.
- `flow-state-authoring`: writing a step's context against the state that will actually be in scope
  where the step runs.

### Modified Capabilities

<!-- `flow-reading-variables` is still an unarchived change, not a published spec; its behaviour is
     extended here through the new capabilities above rather than by a delta against `openspec/specs/`. -->

## Non-Goals

- **No new field on `FlowStep`.** Everything here is derived from the graph and the walked path. The
  only new state is which keys are pinned, which belongs to the reading and dies with it — the same
  rule that already governs depth, derived returns and scope.
- **Not `{{key}}` references in the body.** Deriving `reads` from the payload and decorating it in
  Monaco is the largest item in the design proposal and the one most likely to move; it waits until
  the rest has settled.
- **Not typed values.** Widening `sets` to JSON values needs a migration that does not silently change
  the meaning of strings someone already wrote. Out of scope here, and `JsonTree` in the state root
  waits with it.
- **No evaluation.** The panel keeps reporting and never blocks: an unset read, a broken contract and a
  replaced value are all facts shown, never errors raised.
- **Not the fork/join traversal** deferred as task 11.14 of `flow-reading-call-stack`.

## Impact

- `src/features/canvas/flow/reading/readingVariables.ts` — the fold gains a comparison beside it.
- `src/features/canvas/flow/reading/FlowVariablesPanel.tsx` — delta bar, four row states, watch strip,
  root order and defaults.
- `src/features/canvas/flow/reading/FlowReadingRail.tsx` — passes the previous path and the pin state.
- `src/features/canvas/flow/script/FlowScriptList.tsx` — the scope fix.
- `src/features/canvas/flow/script/StepContextEditor.tsx` — scope grouped by frame; the values table.
- `src/features/canvas/flow/script/stepContext.ts` — row keyboard helpers.
- `src/infrastructure/i18n/locales/{en,pt-BR}.json` — new strings in both locales.
- Design proposal this change implements:
  https://claude.ai/code/artifact/bfff3cc2-e24b-46ed-a247-f31dfea28d5b
