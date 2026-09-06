## Context

See proposal.md — Why. What matters for the approach:

- The reading surface is `src/features/canvas/flow/reading/` — `FlowReadingRail` (392 px column),
  `FlowReadingScene` (the step in hand), and three pure derivations: `stepCall.ts`, `readingScene.ts`,
  `readingSpine.ts`. The rail already renders past / current / upcoming rows from `ReadingSpine`.
- `src/features/diagram` is React-free (AGENTS.md). Every derivation over a `Flow` belongs there or
  in the reading folder as a plain function; neither may import React.
- `buildFlowOutline` (`src/features/diagram/utils/flow-outline.ts`) already owns traversal: it walks
  every reachable step in reading order, assigns the `3` / `4a.1` labels, marks branch heads, and
  reports `unreachable` / `ambiguities` / `collisions` instead of guessing. `readingSpine.ts` consumes
  it. That reporting shape is the precedent the specs point at for orphan responses and unset keys.
- Playback state is `FlowMode` in `flowMode.types.ts`: `{ kind: "playing", flow, currentStepId,
history }`. `useFlowModePlayback` owns the transitions and every one of them is a `setMode` over
  that record.
- `FlowStep.payload` is a `string` today, rendered by `EdgePayloadOverlay` on the active edge only.
- The visual target is the published mockup:
  https://claude.ai/code/artifact/50682576-0db0-4b8b-84d4-e404c98cf783

## Goals / Non-Goals

**Goals:**

- One traversal. Depth, labels and reachability come from the same walk, so they can never disagree.
- Every new structure derived, never stored: no synthetic steps in `flow.steps`, no persisted running
  object, no migration.
- The reading pays for the feature only where a flow uses it — a flat script renders byte-identical UI.

**Non-Goals** (design-level, on top of the proposal's):

- No caching layer beyond React `useMemo`. The derivations are O(steps) over scripts of tens of steps.
- No incremental recomputation. Each of `currentStepId` / `history` change recomputes the fold.
- No virtualised spine. If a script ever gets long enough to need it, that is its own change.

## Decisions

### D1 — The call stack is a second pass over the outline's rows, not a second traversal

`buildCallStack(flow, outline)` walks `outline.rows` in order, maintaining an explicit frame stack,
and returns a `Map<stepId, StepFrameInfo>` plus the list of derived returns and orphan responses.

_Alternative considered:_ a standalone walk of `flow.steps` inside `flow-call-stack.ts`. Rejected —
it duplicates branch traversal, and the two walks would drift the first time reachability rules change.

_Alternative considered:_ extending `buildFlowOutline` to carry depth. Rejected — the outline is
consumed by the script panel and has its own tests; widening its return type to serve the reading
couples two surfaces that have no other reason to move together.

Branch handling falls out of the rows: `FlowOutlineRow.isBranchHead` and `row.branch` say when the
walk has entered a sibling branch, so the pass snapshots the stack at each condition and restores it
on entering a branch head. This is the only place the pass needs outline-specific knowledge.

### D2 — Depth is the number of frames open around the step

A step that opens a frame is placed _before_ its own push. A step that closes one is placed at the
**index of the frame it answers**, not at the top of the stack it is about to shorten. Both ends of a
call therefore land on the same row, and the interior sits one level deeper — the indentation reads
like a function body.

The distinction only shows itself when a response unwinds more than one frame (D3): the naive
`openFrames.length - 1` would put such a response one level below the call it answers, breaking the
one property the whole indentation rests on. Stated once here so the implementation and the tests
share one sentence.

### D3 — A response pops everything above the frame it matches

Matching the nearest open frame for the connection and popping every frame above it is what makes the
derived return fall out of the same rule rather than needing its own detection pass: each frame
popped without an authored step _is_ a derived return. The alternative — refusing to pop when the
match is not the top of the stack — would report a well-formed script (one that simply did not write
its inner returns) as broken.

### D4 — Derived returns are rows, not steps

`ReadingRow` grows an optional `derived: { kind: "return"; toComponentId: string }` and a nullable
`number`. `buildReadingSpine` inserts them; nothing writes to `flow.steps`. This mirrors how the spine
already derives `number` and `heading` without storing either.

Consequence to hold: a derived row is not navigable state. `goNext` from the step before a derived
return lands on the step after it; the row is passed _through_, never _onto_. Keeping derived rows out
of `currentStepId` avoids inventing ids for things the flow does not contain.

### D5 — Step over / step out are `FlowMode` transitions, not rail-local navigation

Both are added to `FlowModeState` beside `goNext` / `goBack`, computed from the stack the rail already
has. They must live in the playback slice because they write `history`, and history is the input to
both the walked spine and the variables fold (D8).

`stepOver` appends every step between the call and its close to `history` in order; `stepOut` appends
every step from the current one to the frame's close. This is what keeps "walked" honest: those steps
did happen, the reader simply did not stop on them. It also makes `goBack` after a skip retrace the
interior one step at a time, which is the behaviour the spec requires and the one a debugger has.

_Alternative considered:_ recording a skip as a single history entry with a span. Rejected — every
consumer of `history` would need to learn about spans, for no user-visible gain.

### D6 — `context.expects` is a JSON string, like `payload`

```ts
export interface FlowStepContext {
  sets?: Record<string, string>;
  reads?: string[];
  expects?: string;
}
```

`payload` is already `string`, parsed opportunistically. Keeping `expects` the same type means one
parse helper, one failure mode, and no new shape in the persisted document — so `flow-migration.ts`
needs no branch and an old flow round-trips untouched.

`sets` values are `string` and not `unknown` on purpose: they are example data a person typed, and
typing them would be the first step toward the schema language the proposal rules out.

### D7 — "Espera receber" is derived from the pairing before it is a field

The body expected back is the `payload` of the step that closes the frame. The stack already knows
which step that is, so the common case costs the author nothing beyond the payload they already
write. `expects` exists only to say something the closing step does not — and it is the presence of
both that enables the drift comparison. This is why the comparison is specified as report-only: the
derived case can never disagree with itself, so a red result always means the author asserted
something.

### D8 — The running object is a fold over `history + current`, recomputed per step

`buildRunningContext(flow, path, frames)` folds `context.sets` in path order and buckets each entry by
the frame its step sat in, dropping a frame's bucket when the frame closes except for entries the
closing step itself introduced.

Deriving rather than mutating is what makes `goBack` correct for free — the spec's "going back
restores the earlier state" is not a feature to build, it is a property of the fold. A mutable
live object would need an undo log to get the same result.

### D9 — The panel's height budget: one root open, the rest collapsed

The rail is a fixed 392 px column with a spine that already competes for vertical space. The drawer
gets `max-height: 40%` of the rail with its own scroll, and opens with **Envia** expanded and the
others collapsed. `Estado` is collapsed by default because it grows with the script while the payload
roots do not.

Collapse state is per-root and held in the rail, reset when the flow changes and preserved across
steps — so a reader who opens `Estado` keeps it open while stepping.

### D10 — The JSON tree is presentational and knows nothing about flows

`JsonTree.tsx` takes parsed JSON and renders it. Type colours are new CSS variables in `src/index.css`
derived from the existing node hues, defined for both themes like every other token. Keeping it free
of flow types means the script panel can reuse it for payload editing later without a refactor.

### D11 — The kind is a field; the reading draws exactly one distinction from it

`conditionKind` is stored on the step, defaults to `alt` when absent, and is read through one helper
so the default lives in a single place. The reading asks it a single question — `isParallelStep` —
and everything it does differently for a `par` (the parallel mark, the sky accent, "all of these run", a
footer that says follow rather than choose, the threads already read, and no way-out marked as taken)
hangs off that one predicate.

_Alternative considered:_ branching the reading on each of the six kinds — a loop drawn as a cycle, an
`opt` drawn as skippable, a `critical` with its fallbacks stacked. Rejected for this change: five of
the six are all "one way out" and differ only in what the diagram calls the fork, so drawing them
apart would be decoration over a distinction the reading does not yet make. The sixth is the one that
changes what happened, and it is the one that gets a treatment.

_Alternative considered:_ keeping the keyword in `conditionLabel` and adding a parser. Rejected — it is
what already existed, and it costs the block its name: the importer overwrote the label with the
keyword, so `par Notificações` arrived as a condition called `par`.

### D12 — A `par` states that its threads all run; it does not walk them

The reading holds one cursor. At a `par` it lists the threads, says outright that following one does
not rule out the rest, and marks the ones already walked so a reader who goes back can see where they
have been. It does not fork the cursor.

_Alternative considered:_ walking every thread at once — interleaving the rows, or reading them side by
side with a join where they meet. Rejected as a separate change: it needs a cursor per thread,
history per thread, a `goBack` that knows which thread it is undoing, and a join step the model has no
concept of. The frames introduced here are what that change would be built on, and stating the fact
truthfully is what stops the reading lying in the meantime — which is what it did when it presented
threads as a choice.

_Alternative considered:_ offering the unread threads when the reading reaches the step after the
block. Rejected here for the same reason: "the step after the block" is the join, and the join is the
thing that does not exist yet.

Marking the threads already read needed one thing the reading did not have: `FlowMode` now carries
`seen` beside `history`. `history` is the path _to_ the step in hand and `goBack` shortens it, which
is what makes the running object time-travel; `seen` only ever grows. Written against the running
editor, where the mark built on `history` alone never appeared at all — entering a thread and coming
back left no trace of ever having entered it.

A note on the mark itself: `∥` is the notation this wants and the wrong glyph to draw it with. At the
sizes the rail uses the system font closes its two strokes into one bar, and one thin bar beside the
call guides reads as another guide. `⇉` survives the size and says what a `par` means — two things
moving, not two lines.

### D13 — One test reads the whole thing, and it is the only one allowed to build nothing

`reading.journey.test.tsx` starts from Mermaid text, puts it through the real importer and the real
store action, drives `useFlowModePlayback`, and gives the rail every prop from that slice. It asserts
only what a reader sees — the edge label of the step in hand, where it landed, who is waiting, what
the two controls do.

Every other test around the reading builds its own props, which is why all of them stayed green
through four separate breakages: a call landing at the component that made it, a recorded script that
never paired, a thread mark derived from a path `goBack` erases, and controls wired to nothing. Each
was found by hand in the running editor.

Kept honest by sabotage rather than by belief: reverting each of those three bugs in turn fails this
test, and reverting the thread mark fails exactly one case in it.

_Alternative considered:_ rendering `WorkspaceContent` itself, so the wiring under test is literally
the product's. Rejected — it drags in the canvas and React Flow, and the harness that replaces it is
twenty lines with no values of its own.

### D14 — Every optional field of a step names where it is written and where it is read

`flow-step-provenance.test.ts` is a table over the optional keys of `FlowStep`, typed so that adding a
field breaks the file until someone fills it in. The runtime check is deliberately weak — the named
file exists and mentions the field — because automatic verification is not the point. Making the
question unskippable is.

It has one entry marked `roundTripOnly`: `connectionIntent`, written by the Mermaid importer and read
only by the Mermaid exporter. That is legitimate, and worth having to say out loud rather than
leaving as an absence that looks exactly like the three fields that shipped with no path at all.

## Risks / Trade-offs

- **Every in-app recorded script derives a flat stack** (`useFlowRecording` never writes
  `payloadDirection`) → The feature would look dead on the flows most users have. Mitigation: the
  spec requires a flat script to render identically to today, so nothing _breaks_. Teaching the
  recorder direction is named as the follow-up change.

  An earlier draft of this note claimed the seed fixture already carried usable directions, so the
  feature would be demonstrable from a fresh install. **That was wrong, and verifying it is what
  found the gap:** the importer marked only the way back, and the seed's response named no
  connection. Both are fixed in this change (proposal, What Changes 8) — without them no data path
  in the product produced a pairable pair, and the feature would have shipped inert.

- **A response popping several frames could surprise an author** who wrote one stray direction →
  Mitigation: every implicit pop renders a visible derived return row, so the consequence is on
  screen rather than silent. Orphan responses are reported the same way.

- **Depth and branch depth are two different numbers on the same row** (`callDepth` vs the outline's
  `depth`) → Mitigation: `ReadingRow` names the new one `callDepth` explicitly, and only the guides
  consume it; the `4a.1` labels stay the outline's business.

- **The drawer competes with the spine for the reader's eye** → Mitigation: collapsed roots by
  default beyond the first, a hard max-height, and total absence when there is nothing to show.

- **`payload` is free text today and some flows hold prose** → Mitigation: parse failure is not an
  error; the panel falls back to the text treatment `EdgePayloadOverlay` already gives it.

- **Promoting the keyword drops a `conditionLabel` that reads as one** → someone who genuinely
  titled a branch point "loop" loses that word. Accepted: it is the one string the old code already
  treated as the keyword, so its meaning is unchanged — only where it is stored is. Mitigation: the
  migration moves rather than deletes, and only when no kind is declared.

## Migration Plan

None required for the call stack or the variables. Every field they add is optional and no persisted
shape changes.

`conditionKind` (D11) needs one pass, and it is additive: `flow-migration.ts` moves a
`conditionLabel` that is exactly a keyword into the field on load, leaves anything else alone, and is
idempotent because it runs on every rehydrate. A flow written before this change reads exactly as it does today; a flow written after it
opens in an older build with `context` ignored by the type-guarded read path.

## Open Questions

- Whether the breadcrumb should name the **caller component** or the **connection label** when a
  component appears twice in the stack (recursive or repeated calls). Both are derivable from the
  frame; the choice can be made against a real script during implementation without touching the
  specs, which say only "the components whose frames are open".
