# Tasks

## 1. Handles and serialize with ids

- [x] 1.1 Parse a trailing `{#name}` on step, decision and end lines (`\{` escape), and keep it on the AST node. Paste, insert and the assistant's add tool ignore it. Verify:
  - outline parse tests (handle, escaped brace, handle on an exit line, invalid handle characters);
  - a paste test showing the name has no handle.
- [x] 1.2 Add `serializeWithIds` returning text, `lineIds`, handles and `protectedIds`, and "Copy as… Text with ids" in the format list. Verify:
  - serialize tests (handles numbered in reading order, lineIds aligned to lines, unreachable steps and extra edges in `protectedIds`);
  - the KindTextPanel copy test for the new format.

## 2. Reconcile

- [x] 2.1 Add the line alignment (Myers on trimmed lines, 1:1 pairing in replace hunks, handles overriding). Verify: unit tests for rename, rescore, insert, delete, swapping two lines, and a moved line with and without a handle.
- [x] 2.2 Factor the AST walk out of `buildOutline` and add `reconcileOutline(diagram, base, edited) → { edit, changes } | { errors }`, covering updates, reparent, add, remove and the edge diff restricted to expressible edges. Verify harness tests for:
  - each change kind;
  - one undo restoring all;
  - an unreachable step and a non-decision extra edge surviving;
  - an unknown handle as a line error;
  - `buildOutline` tests unchanged and passing.
- [x] 2.3 Stale base: reconcile against the current diagram with the base ids, skipping and counting missing ids. Verify: a harness test with a step deleted between serialize and apply.
- [x] 2.4 Performance: reconcile a 300-step journey with 20 edits. Verify: a test under 200 ms.

## 3. Panel

- [x] 3.1 Add `serializeWithIds` and `reconcile` to `KindTextCapture`, and implement them for guided. Verify: typecheck passes, and the contract docs in `docs/concepts/diagram-kinds.md` are updated.
- [x] 3.2 Panel: open with the whole journey, follow the diagram while unedited, add the change count and "Review" list, apply with Ctrl/Cmd+Enter, show the stale banner with "Reload from the diagram", and select the first changed step after applying. Move the add-only text to "Insert at the selection". Verify:
  - component tests for opening, following, the review list, apply plus undo, the banner and insert;
  - en and pt-BR keys added, and the i18n coverage test passes.
- [x] 3.3 Assistant prompt: describe handles (the current journey is still sent without them until the assistant-revisions change). Verify: a prompt test.

## 4. Integration

- [x] 4.1 Add a Cypress scratch tour: open the panel, rename a step, rescore another, delete one and add one, review, apply, undo; then edit on the canvas while the text is dirty and check the banner. Run `openspec validate guided-journey-live-text`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
