## Context

See proposal.md — Why. The material this change needs already exists and is already correct:

- `buildRunningContext(flow, callStack, path)` folds the walked path into the running object, grouped
  by the frame each value was introduced inside, dropping a frame's values when the frame closes.
- `buildCallStack` pairs requests with responses and knows which frames a step opens and closes.
- `getPathToStep(flow, stepId)` returns the first path from the entry that reaches a step.
- The reading holds `history` (the path to the step in hand) and `seen` (every step ever stood on).

Nothing here needs a new derivation. What is missing is a *comparison* beside the fold, and an
interface that reads the comparison rather than the fold's result.

## Goals / Non-Goals

**Goals**

- One comparison function, pure, tested without rendering anything, that every new marker reads from.
- The authoring panel and the reading panel to share a single definition of "in scope at this step",
  so they cannot drift apart again.
- Additive changes only: a flow written before this change reads identically after it.

**Non-Goals** — beyond the proposal's: no change to `buildRunningContext`'s fold rules. If the fold is
wrong somewhere, that is a separate defect; this change compares what the fold produces.

## Decisions

### D1 — The delta is a comparison of two folds, not a log

`describeContextChange(flow, callStack, path)` folds the path and the path without its last step, and
reports the difference. It takes the path rather than two contexts so that no caller can hand it two
folds that were never one step apart. Folding twice is O(path) twice, on a path at most the length of
a flow, on a panel that re-renders once per step.

*Alternative considered:* have `buildRunningContext` emit events as it folds. Rejected — it would make
the fold's return depend on where the caller happens to stop, and the fold is used in four places that
do not want events. A comparison keeps the fold a fold.

*Alternative considered:* store the previous context in the playback slice. Rejected — that is state
that can go stale and disagree with the path, which is the exact class of bug this change is fixing.

### D2 — "Gone" is derived from frames, not from absence

A key can vanish between two folds for exactly one reason: the frame holding it closed. So the diff
does not report "keys in before and not in after" as a category of its own — it asks the call stack
which frames the step closed, and reports the keys those frames held, naming the call. A key that
disappeared for any *other* reason would be a bug in the fold, and reporting it as an ordinary
category would hide that.

### D3 — "Leaving" is the same fact, one step early

The dimmed *leaving* marker is not a fourth derivation. On the step that closes a frame, the fold has
already dropped that frame — so the values are gone from `after` and present in `before`. That is the
same set D2 reports as gone. The panel renders that set inline, dimmed, instead of only counting it,
which is why the value is visible on the step that ends it and absent on the next.

### D4 — The scope fix folds the whole path, holding back one step's values

`scopeOf` becomes `buildRunningContext(flow, stack, getPathToStep(flow, stepId), stepId)` — the whole
path, the step included, with a fourth argument naming the one step whose `sets` are skipped. The
author is writing *against* the state, so their own contribution is the one thing not to show.

Subtracting after the fold would have been wrong in a way that is easy to miss: a key the step
replaces would vanish entirely, taking with it the shadow marker that says which value is being
written over. Skipping the step's `sets` inside the fold leaves the previous holder in place, which is
exactly what the author needs to see — and only when that holder is still in a surviving frame, since
the fold has already run every drop.

*Alternative considered:* keep `slice(0, -1)` and apply the step's frame drop by hand. Rejected — it
reimplements one rule of the fold outside the fold, which is how the two got out of step.

### D5 — Pins live in the flow-mode slice, keyed by nothing

`pinnedKeys: string[]` on the playing mode, beside `seen`. Pins are per-reading: switching flows or
leaving playback clears them, which is what `play`/`switchFlow` already do for `history` and `seen`.
Keys, not step ids — the reader pins a name and wants to watch it across the frames that hold it, which
is precisely what makes the out-of-scope state meaningful.

### D6 — The life of a key is a fold that does not throw its intermediates away

`keyLife(flow, callStack, path, key)` walks the path once, folding as `buildRunningContext` does, and
records an event whenever the key is introduced, replaced, read, or dropped with a frame. It repeats
the fold's rules rather than calling it per prefix, which would be O(n²); the rules are six lines and
the test asserts the two agree at every prefix of a path.

*Alternative considered:* fold every prefix and diff consecutive pairs. Correct and much slower, but a
better oracle — so that is what the test does, on a small flow, to pin the fast version.

### D7 — Order and defaults are the smallest change with the largest effect

State moves above the payload roots and opens by default. The payload roots are properties of the step
and are already spoken by the rail; the running object is the only root that accumulates. `Root` keeps
its own open state, so a reader who shuts it keeps it shut as they walk.

### D8 — The values table stays uncontrolled per row

`SetRow` already carries an identity so a half-typed key survives. The keyboard work adds behaviour
around those rows and no new source of truth: Enter appends a row and focuses it, Tab is the browser's,
blur drops keyless rows, and paste parses into rows before any row exists.

Paste splits on the **first** colon per line, so a value holding a colon — a URL, a timestamp — stays
whole. A pasted JSON object is a separate branch, taking top-level entries only, the same rule
`setsFromPayload` already applies.

### D9 — A read that resolves and one that does not cannot look alike

The scope panel exists so a key the reading will call undefined is visible while it is being written.
Showing the scope is half of that; the other half is the chips, where a key nothing sets rendered
identically to one that does. It is marked instead — the same amber the reading uses for the same
fact, said in the place the mistake is made.

### D10 — A claim about what happens after a step needs the other direction of the graph

`getPathToStep` walks from the entry and answers *how did the reading get here*. The marker saying
where a call's values run out is a claim about what happens *next*, and scanning the whole script for
the step that answers gets it wrong the moment the answer sits inside a branch: someone writing the
other branch is told their values end at a step that branch never reaches. `canReachStep(flow, from,
target)` — a cycle-guarded walk forward — gates the marker, so a claim is made only where it holds.

Deliberately not narrower: reachable on *some* path is enough to say the call can end there. Saying it
only when every path answers would be a different, weaker statement, and the reader is looking at one
way through.

### D11 — Every part of the panel reads the same set

The running object and the leaving set are two different questions about the same step, and any part
of the panel that asks only the first will disagree with any part that asks both. That is not
hypothetical: the watch strip read `byKey` alone and called a key out of scope on exactly the step
where the list below it showed the value going. Anything naming a key now consults the change first.

## Risks / Trade-offs

- **The scope fix changes what existing scripts show in the editor.** A key that used to be offered and
  should not have been will disappear. That is the point, and it is the editor only — no stored data
  changes — but it will look like a regression to anyone who wrote a `reads` against the old panel.
  → The reading was already reporting those as unset; the panel now agrees with the report. The seed
  carries the case (`ct-cs-7`), so it is visible on a fresh install rather than only in a test.

- **Three folds per render, where two would do.** The rail folds the walked path for the running
  object, and `describeContextChange` folds it again alongside the shorter path — so the same fold runs
  twice on every step. Each is memoised on `[flow, callStack, walked]`, and the fold is linear over a
  path of tens of steps, so this is waste rather than a problem. → The fix is for the change to hand
  back the context it already folded; see Open Questions.

- **`keyLife` repeats the fold's rules.** If the fold changes and `keyLife` does not, they diverge
  silently. → The test compares it against the prefix-diff oracle rather than against a fixture, so a
  change to the fold breaks it.

- **A pinned key that is out of scope everywhere reads as broken.** → It says *out of scope*, which is
  a fact about the walk. The alternative — hiding it — is what makes the frame rule invisible today.

## Migration Plan

None. No stored shape changes, so there is nothing to migrate and nothing to roll back beyond the code.
Flows written before this change read identically after it; the only difference is what the panels say
about them.

## Open Questions

- Whether the delta bar's markers should filter the list on click, or only count. Filtering is easy to
  add later and does not change any requirement, so it is left out of the first pass rather than
  guessed at.
- Whether `describeContextChange` should return the running object it folded, so the rail stops folding
  the same path twice. It is a pure saving with no behaviour attached, which is why it is a question
  rather than a decision: it widens a return type that three call sites already read.
