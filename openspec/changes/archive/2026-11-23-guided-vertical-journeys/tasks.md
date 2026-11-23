# Tasks

## 1. Switch

- [x] 1.1 Extract `useDiagramDirectionSwitch` from the ArrangeControl wiring and use it in both the Organizar menu and a new mode-bar toggle. Verify: the ArrangeControl tests pass, a KindModeBar test covers switching with undo, and the toggle is disabled when the direction is locked.

## 2. Creation

- [x] 2.1 Add the direction choice to the creation dialog for guided, and `direction` to `createKindDiagram`. Verify: a dialog test, and a test showing a vertical creation gives vertical lanes with the start at the top.

## 3. Mermaid

- [x] 3.1 Read the header direction in the Mermaid parser and apply it when adding to a journey with only its start step, in one undo step. Verify: tests for `flowchart TD` into a new journey, into an existing journey (kept), and `LR`.

## 4. Parity

- [x] 4.1 Add TB parity tests: the same journey's outline is equal in LR and TB; the band, line and tags lie along y; framing bounds include the band; and the draw.io layer is placed left. Verify: tests pass.

## 5. Wrap-up

- [x] 5.1 Add en and pt-BR keys, the docs, and a Cypress scratch tour: create vertical, paste `flowchart TD`, toggle in the mode bar, undo. Run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
