# Tasks

## 1. Phase band

- [x] 1.1 Add `guidedRenamePhase` and `guidedMovePhaseStart`, and the overlay's `rename` and `moves` outcomes. Verify: harness tests for rename, removal by an empty name, moves earlier and later, the bounds between neighbouring starts, and undo.
- [x] 1.2 In `KindOverlayView`, add the inline segment editor (double-click, Enter, Esc) and separator dragging with a snapped preview, in editable kind mode only. Verify: component tests for rename, cancel, drag and drop to a candidate, and nothing in read-only mode.

## 2. Step name shortcuts

- [x] 2.1 Add the `nameCommit` hook to the contract, and the guided implementation (decision, end, lane, escapes, refusal). Verify: unit tests for each shortcut, a new lane, an end with exits refused, and escapes.
- [x] 2.2 Call the hook from the element panel's name commit in kind mode. Verify: a component test showing `API: ? Valid?` from the title.

## 3. Lane headers

- [x] 3.1 Add the inline header editor on the swimlane node in kind mode. Verify: a component test for rename and Esc, and that freehand mode has no editor.

## 4. Wrap-up

- [x] 4.1 Add en and pt-BR keys, the docs (Phases, Step names, Lanes), and a Cypress scratch tour: rename a phase, drag a separator, type `API: ? X` in a title, rename a lane. Run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
