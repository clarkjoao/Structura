# Tasks

## 1. Model and store

- [x] 1.1 Add `DiagramDirection` and `Diagram.direction?: "TB"`; widen `Connection.sourceSide` / `targetSide`; make `ReadingDirection` the same type. Verify with `npm run typecheck`.
- [x] 1.2 Carry `direction` in history checkpoints, an `applyAutoLayout` `direction` option (structural checkpoint) and the folder-sync equality. Verify with slice tests: write, undo, redo, and LR stores nothing.

## 2. Layout by transposition

- [x] 2.1 Add `layout/axis.ts` (`transposeGraph`, `transposeResult`, point helpers) and engine support for `leftInset`. Verify with involution tests and a `leftInset` padding test.
- [x] 2.2 Thread `direction` through `planDiagramAutoLayout`, `applyLayoutResultEdges`, `autoLayoutActiveDiagram`, `layoutScopedNodes` and `usePanelChildLayout`. Verify that TB arranges a chain downwards with children inside panels, and that the LR baselines are unchanged.
- [x] 2.3 Make `placeIncrementally` direction-aware by transposition. Verify that TB places one row below and nothing else moves.
- [x] 2.4 Record TB readability over the reference diagrams in an experiment test. Verify that the numbers are in design.md.

## 3. Edges and handles

- [x] 3.1 Make `sidesFromHandles` and `buildEdgeHandleAssignments` direction-aware, and pass the diagram direction from every caller. Verify with `fixedSides` TB cases and the cross-axis cases.
- [x] 3.2 Give `DiagramSurface` a `readingDirection` prop and provider, set by the editor and the viewer. Verify that TB nodes render top/bottom handles in a component test.

## 4. Switch and UI

- [x] 4.1 Add a `direction` run option to `runAutoLayout` / `arrange` that writes the field in the plan's store write. Verify with a test that a switch and one undo restore direction, positions and routes.
- [x] 4.2 Add the direction control to the Arrange menu (disabled when read-only or in a live session), with en/pt-BR copy. Verify with `ArrangeControl` tests and i18n parity.

## 5. Rule and docs

- [x] 5.1 Restate the AGENTS.md hard rule per axis; mark ADR-0013 Accepted with an amendment (transposition, `verticalSides` kept); update the ADR index and `docs/features.md`. Verify by review.

## 6. Integration checks

- [x] 6.1 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run fallow:check`. Verify all of them are green.
- [x] 6.2 Manual pass: switch a seed diagram to vertical and back, undo, check the handles, draw a cross-axis edge, and use automatic placement in vertical.
