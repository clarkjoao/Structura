# Tasks

Prerequisite: `guided-journey-live-text` is implemented (handles, `serializeWithIds`, `reconcile`).

## 1. Engine

- [x] 1.1 Extend `reconcile` with change keys, dependency groups (union-find over added steps and connections, and removal with its reconnection), each change's phase, and `editFor(keys)`. Verify harness tests for:
  - the groups in the spec scenarios;
  - applying a subset;
  - an applied subset never leaving a dangling connection;
  - keys stable across a re-reconcile.
- [x] 1.2 Read `# why:` reasons onto the next step line's changes. Verify: unit tests (a reason above a rename, a reason above an added step, a stray reason at the end that is ignored).

## 2. Assistant

- [x] 2.1 Prompt: send the current journey with handles, keep the handle map on the turn, and document the two tools and when to use each. Verify: prompt tests for the handles scenario and the tool guidance, and the add tool still ignoring handles.
- [x] 2.2 Add the `revise_journey` tool definition, the parser to `REVISE_JOURNEY`, and the check that returns per-line errors to the assistant on failure. Verify: patch-parser tests (valid, missing outline, unknown handle), and a tool-result test with the errors.
- [x] 2.3 Store: keep the tick state per suggestion, re-reconcile on diagram change (debounced), mirror ticked changes into `pendingPreviews` with tones, and clear on apply or reject. Verify: store tests for toggling, a stale change after a deletion, and the preview ids following the ticks.

## 3. Card

- [x] 3.1 Add the `SuggestionCard` revision mode: phase groups, group checkboxes, reasons, stale rows, "Apply selected (n)" as one undo step, "Reject", and "Tick all" / "Untick all" per phase. Add en and pt-BR keys. Verify:
  - component tests for the spec scenarios (grouped list, partial accept with undo, dependent unticking, stale row);
  - the i18n coverage test passes.
- [x] 3.2 Canvas preview tone for removals (`PendingNodePreview.tone`). Verify: a preview render test showing the remove tone on a step marked for removal.
- [x] 3.3 Docs: add assistant revisions to `docs/concepts/diagram-kinds.md` (the tools, handles, reasons, partial accept). Verify: the docs cover all four, and prettier passes.

## 4. Integration

- [ ] 4.1 Add a headless eval through the API endpoint: ask the assistant to "improve the pain points" on a fixture journey, and check that it calls `revise_journey` with valid handles. Verify: the eval passes in 4 of 5 runs.
- [x] 4.2 Add a Cypress scratch tour with a mocked assistant reply: review the card, untick one group, apply, check the canvas and undo. Run `openspec validate guided-assistant-revisions`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
