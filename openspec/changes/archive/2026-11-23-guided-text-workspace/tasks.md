# Tasks

## 1. Body and dock

- [x] 1.1 Extract `KindTextBody` from `KindTextPanel`, keeping the popover frame. Verify: the existing KindTextPanel tests pass unchanged.
- [x] 1.2 Add `KindTextDock` (left column, 280–640 px resize, undock) and the `textDock` preference with its width. Verify: component tests for dock and undock, the remembered width, and that the dock stays open across canvas selection.

## 2. Line–step link

- [x] 2.1 Link the cursor to a step (debounced selection and framing), and the canvas selection to a line (highlight and scroll), for untouched and edited texts. Verify: component tests in both directions, including an edited draft.

## 3. Suggestions and markers

- [x] 3.1 Add the `suggest` contract and the guided implementation (lanes, steps after `@`, phases after `##`). Verify: unit tests for each context, prefix filtering, and none mid-name.
- [x] 3.2 Add the suggestion list UI (Tab, Enter, Esc, caret positioning) and the gutter error markers with tooltips. Verify: component tests for completing `@Esc`, dismissing, a plain Enter, and a marker on an error line.

## 4. Wrap-up

- [x] 4.1 Add en and pt-BR keys and the docs, and a Cypress scratch tour: dock, move the cursor to an off-screen step, select on the canvas, autocomplete a jump, see an error marker. Run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
