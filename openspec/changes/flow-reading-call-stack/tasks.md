## 1. Model and pairing derivation (React-free)

- [x] 1.1 Add `FlowStepContext` (`sets?`, `reads?`, `expects?`) and optional `FlowStep.context` to `src/features/diagram/model/flow.types.ts`; verify `npm run typecheck` passes and `flow-migration.ts` needs no new branch by round-tripping an existing seed flow through the migration test.
- [x] 1.2 Create `src/features/diagram/utils/flow-call-stack.ts` exporting `buildCallStack(flow, outline)` returning per-step `{ callDepth, opensFrameId, closesFrameId }`, the frame list, derived returns and orphan responses; verify a unit test covers a request opening a frame, a step with no direction opening none, and a component-only step opening none.
- [x] 1.3 Implement the response matching rule from design D3 — nearest open frame on the same connection, popping every frame above it as a derived return; verify tests cover the plain close, the close that pops one frame above it, and an orphan response reported rather than popped.
- [x] 1.4 Implement the depth rule from design D2 (frames open around the step; a response sits at the index of the call it answers); verify tests assert a call and its return share a depth and an interior step sits one deeper.
- [x] 1.5 Handle async: a step with `isAsync` opens a detached frame that never closes, contributes no depth and never enters the breadcrumb; verify a test asserts the following step keeps the async step's depth and that a later matching response is reported as an orphan.
- [x] 1.6 Snapshot and restore the frame stack at branch heads using `FlowOutlineRow.isBranchHead` / `row.branch`; verify a test with an unclosed frame inside branch A asserts branch B's first step is back at the condition's depth.
- [x] 1.7 Export `buildCallStack` and its types from `src/features/diagram/index.ts`; verify `npm run typecheck` and that `src/features/diagram` still imports no React (existing boundary test / lint).

## 2. Spine carries depth and derived returns

- [x] 2.1 Widen `ReadingRow` in `readingSpine.ts` with `callDepth`, `opensFrame`, `closesFrame`, an optional `derived` marker and a nullable `number`; verify the existing 17 `readingSpine.test.ts` cases still pass unchanged.
- [x] 2.2 Feed `buildCallStack` into `buildReadingSpine` and populate the new fields on past, current and upcoming rows; verify a test asserts depths across a three-level script match the fixture in design D2.
- [x] 2.3 Insert derived return rows where a frame closes with no authored response, carrying the caller's component id and no number; verify tests assert the row appears, that an authored response suppresses it, and that `flow.steps` is byte-identical after building the spine.
- [x] 2.4 Confirm a flow with no `payloadDirection` produces every row at `callDepth: 0` with no derived rows; verify a dedicated regression test asserts this on a three-step fixture.

## 3. Rail renders the stack

- [x] 3.1 Render one continuous vertical guide per open frame in `FlowReadingRail`, indenting content only and leaving the mono number gutter fixed; verify a test asserts a depth-2 row renders two guides and that step numbers at depth 0 and 3 share the same column.
- [x] 3.2 Add the frame breadcrumb to `FlowReadingScene`, outermost caller first, absent at depth 0; verify tests cover the three-frame ordering and the depth-0 absence.
- [x] 3.3 Make each breadcrumb segment step out to that frame; verify a test asserts selecting the second segment calls the step-out handler with that frame.
- [x] 3.4 Render derived return rows in the spine with the derived treatment and no number; verify a test asserts the row's text names the caller and that no step number is rendered.

## 4. Step over and step out

- [x] 4.1 Add `stepOver` and `stepOut` to `FlowModeState` / `flowMode.types.ts` and implement them in `useFlowModePlayback`; verify `npm run typecheck` passes and the new actions are exposed through `FlowModeContext`.
- [x] 4.2 Implement `stepOver`: land on the step that closes the frame, or the step after the frame when it closes with a derived return; verify tests cover both landings and that no target means no transition.
- [x] 4.3 Implement `stepOut`: land on where the innermost frame closes; verify a test asserts the landing and that calling it at depth 0 is a no-op.
- [x] 4.4 Append every skipped step to `history` in reading order for both actions (design D5); verify tests assert the four skipped steps are in history and that `goBack` after a step-over lands on the last interior step, not the call.
- [x] 4.5 Render the two controls in the rail footer, each only when it has a target, with the step-out control naming its destination component; verify tests cover presence on a call that returns, absence on a step with no direction, absence on an async step, and absence of step-out at depth 0.
- [x] 4.6 Pass the two handlers from `WorkspaceContent` to the rail; verify the app builds and the controls drive the reading end to end in the running editor.

## 5. Variables derivation

- [x] 5.1 Create `readingVariables.ts` with a JSON parse helper that returns parsed content or `null` for free text, never throwing; verify tests cover an object, an array, and prose falling back to text.
- [x] 5.2 Derive the sends root from the step's own `payload`, labelled by `payloadDirection`; verify tests assert the request and response labels differ and that a payload-less step yields no root.
- [x] 5.3 Derive the expects root from the payload of the step that closes the frame, attributed to that step, with an explicit `context.expects` taking precedence; verify tests cover the derived case, the explicit override, and the async case stating nothing comes back.
- [x] 5.4 Implement `buildRunningContext` folding `context.sets` over `history + current`, bucketed by the frame each step sat in (design D8); verify tests cover a value appearing at its step, a later value replacing an earlier one, and the value's origin step being recorded.
- [x] 5.5 Drop a frame's bucket when the frame closes, except entries introduced by the closing step; verify tests assert an interior value disappears after the return and a response-carried value survives into the caller's frame.
- [x] 5.6 Mark the keys in `context.reads` and report a read of a key nothing sets, in the shape `buildFlowOutline` uses for `unreachable`; verify tests cover the marking and the report.
- [x] 5.7 Implement the explicit-`expects` comparison reporting expected-but-absent and arrived-but-unexpected keys, report-only; verify tests cover a match, a missing key, and that neither result changes either body.

## 6. Variables panel

- [x] 6.1 Add JSON type colour tokens to `src/index.css` for light, `prefers-color-scheme: dark` and `[data-theme="dark"]`, derived from the existing node hues; verify every token is defined in the bare `:root` block before any override.
- [x] 6.2 Build `JsonTree.tsx` — collapsible nested objects and arrays, indent guides, values coloured by type, no flow types imported (design D10); verify tests cover expanding a nested object and rendering each JSON type.
- [x] 6.3 Build `FlowVariablesPanel.tsx` with the three collapsible roots, `max-height: 40%` of the rail and its own scroll, opening with the sends root expanded and the rest collapsed (design D9); verify tests assert the default open/collapsed state and that root collapse state survives a step change.
- [x] 6.4 Render nothing — panel and divider — when there is no payload, no expected body and an empty running object; verify tests cover the wholly empty script and the panel appearing only on the step that carries a payload.
- [x] 6.5 Show each value's origin step and move the reading there when it is selected; verify a test asserts the origin is named and selecting it navigates.
- [x] 6.6 Mount the panel in `FlowReadingRail` above the footer; verify the rail's existing 24 tests still pass and a new test asserts the panel is absent for a context-free flow.

## 7. Condition reads its value

- [x] 7.1 Show the current value of each key a condition declares in `reads`, with its origin, alongside the question in `FlowReadingScene`; verify tests cover the value being shown and a condition with no `reads` rendering unchanged.
- [x] 7.2 Mark the way out a branch label corresponds to when one matches the read value; verify a test asserts the matching branch is marked and that no marking appears when nothing matches.

## 8. Translations

- [x] 8.1 Add every new `flowReading.*` key to `en.json` and `pt-BR.json` — derived return, step-over and step-out labels and titles, breadcrumb label, the three root labels, nothing-comes-back, comparison results, origin attribution; verify `flow-locale-coverage.test.ts` passes and no `t()` call in `flow/reading/` supplies a default.

## 9. Feeding the pairing (found while verifying)

- [x] 9.1 Teach the Mermaid sequence importer that an outward message is a request, not only that a returning one is a response; verify tests assert an imported three-level sequence derives depths `[0,1,2,2,1,0]` with no orphan responses, and that the existing import tests still pass.
- [x] 9.2 Give the seed's context-script response the connection its call went out over; verify a test asserts the seeded script opens, nests and closes a call, and that no seeded flow has an orphan response.

## 10. Writing a context (the field had no way in)

- [x] 10.1 Build `StepContextEditor` in the script panel — the values a step introduces as `key: value` lines, the keys it consumes as a list, and the expected body as JSON on a step that opens a call; verify tests cover parsing, round-tripping, and each field reaching `updateStep`.
- [x] 10.2 Offer to fill the values from the step's own body in one gesture, taking only top-level keys of a JSON object; verify tests cover an object, a nested value kept as its shape, and prose offering nothing.
- [x] 10.3 Drop `context` entirely once its last member is cleared, so a step that carries nothing stays that way; verify a test asserts `undefined` reaches `updateStep`.

- [x] 10.4 Let each field own its text instead of reformatting the parsed result back into it; verify tests type a key one character at a time and assert both the field's own value and the parsed result survive — reformatting turned `score: 0.12` into the key `s` holding `core:0.12`.

## 11. What the review turned up

- [x] 11.1 Teach the importer that a dashed arrow is a reply and only `-)` / `--)` are fire-and-forget, and let the exporter choose the glyph from direction _and_ asyncness; verify a round-trip test asserts all five arrow shapes survive and the output is byte-stable from the first pass.
- [x] 11.2 Let the connection decide where a step lands when it names one, since the Mermaid importer writes the message's _sender_ into `componentId`; verify tests cover a step naming both, in each direction, and the fallback when the connection is gone.
- [x] 11.3 Bind F10 to step over and Shift+F11 to step out, and name the key in each control's tooltip while the accessible label stays clean; verify tests assert both tooltips.
- [x] 11.4 Derive `payloadDirection` when recording an edge click — an edge the script went down and has not returned from is the way back; verify tests cover the rule and a simulated six-click recording deriving depths `[0,1,2,2,1,0]`.
- [x] 11.5 Carry the calls still owed a return on the flow highlight and keep those edges lit above the flow's others; verify tests cover the set and each edge-opacity tier.
- [x] 11.6 Add `FlowConditionKind` and `FlowStep.conditionKind`, defaulting to `alt` through one helper so no other reader knows the default; verify tests cover the default, a declared kind, and that a label reading `"loop"` no longer makes a step a loop.
- [x] 11.7 Promote a `conditionLabel` that is exactly a keyword into `conditionKind` on load, leaving every other label alone; verify tests cover the promotion, an author's question surviving, a step that already declares a kind, idempotence across two loads, and the exported block being unchanged.
- [x] 11.8 Let the Mermaid importer write the kind instead of overwriting the label, and the exporter choose the keyword and separator from the field alone; verify round-trip tests assert `par …` / `and …` / `end` survives, the branch labels are the block's own names, and the output is byte-stable from the first pass.
- [x] 11.9 Offer the six kinds on the branch point's row in the script panel; verify tests drive the control and assert the kind reaches the step, the question is untouched, and the row's mark changes — the piece is no use without a path to it, which is what 10.1 was for.
- [x] 11.10 Carry the kind on `ReadingRow` and whether each way out has been walked on `ReadingBranch`; verify tests cover the kind on a condition row, its absence elsewhere, and the walked marking across none, one and both threads.
- [x] 11.11 Read a `par` as threads — paired arrows in place of `◇`, the statement that all of them run, a footer that says follow rather than choose, the threads already read marked, and no way out marked as taken; verify tests cover each, plus a condition with no kind rendering exactly as before.
- [x] 11.12 Name a branch point with no title and no question after its kind, in both locales, everywhere the glyph appears — the rail, the script list, the navigator and the recorder's branch view; verify a test asserts the heading and that `flow-locale-coverage.test.ts` passes.
- [x] 11.13 Keep every step the reading has stood on, separately from the path it took, so going back does not un-see a thread; verify tests assert the step turned back from is kept, that passing through twice records it once, that another script starts empty, and that the rail marks a thread reached only through `seen`.
- [ ] 11.14 Walk the threads of a `par` rather than only state that they run — a cursor per thread, a history per thread, a `goBack` that knows which one it is undoing, and the join where they meet. **Not done: this is the fork/join change, built on the frames added here (design D12).**

## 12. Gates

- [x] 12.1 Run `npm run typecheck`, `npx prettier --check src/`, `npm run lint` and `npm run test`; verify typecheck and prettier are clean, lint introduces no new warnings beyond the 27 pre-existing `react-refresh/only-export-components`, and the full suite passes.
- [x] 12.2 Read a paired script end to end in the running editor — the seed's context script, or a Mermaid sequence import — checking indentation, breadcrumb, step over, step out, derived returns and the panel against the mockup; verify by screenshot and note any deviation.
- [x] 12.3 Read a flow with no `payloadDirection` and no `context` in the same editor; verify the rail is visually identical to the pre-change build (no guides, breadcrumb, derived rows, extra controls or panel).
- [x] 12.4 Import a sequence carrying a `par` block and read it in the running editor; verify the block is named rather than untitled, marked as threads, states that they all run, prompts to follow one, marks a thread already read, and that a plain condition beside it is unchanged.

## 13. What the review of the review turned up

- [x] 13.1 Read the whole reading end to end in one test — real Mermaid text through the real importer and the real store action, driven by `useFlowModePlayback`, with every rail prop derived from it; verify the test fails when the target is read off `componentId`, when the importer stops marking requests, and when the thread mark is derived from `history` again.
- [x] 13.2 Name a producer and a consumer for every optional field of `FlowStep`, enforced by the type so a new field cannot be added without one; verify adding a field breaks the typecheck, and that `connectionIntent` is recorded as round-trip-only rather than left as an absence.
- [x] 13.3 Give `loop`, `opt` and `break` the line each is owed — a loop repeats, an optional part may not happen, a break stops the reading — and a `↻` for the loop; verify tests cover each note, the `◇` kept by every kind that is neither threads nor a loop, and `alt` / `critical` saying nothing extra.
- [x] 13.4 Parse a block inside a block instead of discarding it with a warning; verify tests assert an `alt` nested in a `par` keeps both kinds, both branch labels, every message, and a byte-stable round trip.
- [x] 13.5 Rename `ReadingBranch.walked` to `visited`, since the rail's own `walked` asks whether a row is on the path and this asks whether the reader has ever been there; verify the typecheck and the reading tests.
- [x] 13.6 Correct `stepsAhead`'s reason: the count is a floor at a `par` because the reading has one cursor, not because nobody knows which way it will go. **The number itself was right** — the review claimed a defect that was not there.

## 14. The panel someone writes in

- [x] 14.1 Give every field in the expanded row a label that survives being filled, grouped under Passo / Chamada / Estado, instead of an emoji and a placeholder that vanishes on the first keystroke; verify the script tests still pass and the row reads in both locales.
- [x] 14.2 Edit the bodies as JSON in the editor the product already uses — highlighting, bracket matching, folding and a format action — reporting when the content is not JSON rather than refusing it, since `payload` is free text by design; verify a stand-in keeps the tests running in jsdom and the real editor is checked in a browser.
- [x] 14.3 Make the values a step introduces rows with identities of their own instead of `key: value` text; verify tests cover the round trip, a half-typed key reaching nothing, a value holding a colon, and a key typed one character at a time — the failure this removes by construction.
- [x] 14.4 Show the state as it stands where the author is editing, folded by `buildRunningContext` over `getPathToStep` so the panel written in and the panel read from cannot disagree; verify tests cover the path through a branch, a step both branches reach, an unreachable step and a cycle.
- [x] 14.5 Offer the keys in scope as the ones a step consumes, keeping free entry for a key nothing sets; verify tests cover the chips, the marking, taking one off, and a key already read that nothing sets.
- [x] 14.6 Say when a value replaces one already in scope, and where that one came from; verify tests cover the marking and its absence.
- [x] 14.7 Mark, in the reading, the values the step in hand has just introduced — the one thing a debugger's variables pane always says, and the reason `flowReading.newValue` had sat unused in both locales since it was written; verify tests cover the marking, its absence on an earlier value, and its absence when no step is named.
- [x] 14.8 Author a context end to end in the running editor; verify by screenshot that `score` / `0.12` types cleanly, that the next step shows it under Estado aqui with its origin, that it is offered as a key to consume, that a key replacing it says so, and that the reading marks it new on the step that set it and not on the next.
