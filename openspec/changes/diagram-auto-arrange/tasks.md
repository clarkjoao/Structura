# Tasks

## 1. Model and store

- [x] 1.1 Add `LayoutMode` and `mode` to `DiagramLayoutSettings`. Have `normalizeLayoutSettings` and `sameLayoutSettings` handle it, with manual dropped as the default. Verify with unit tests in `layout-settings.test.ts`.
- [x] 1.2 Add a `history` option to `applyAutoLayout` and `resetEdgeControlPoints`. With `false`, no checkpoint is pushed. Verify with a slice test: an edit followed by an `applyAutoLayout(…, { history: false })` is undone in one step, and redo still works.
- [x] 1.3 Add a `setDiagramLayoutSettings(diagramId, settings)` action: structural checkpoint, normalised write, positions untouched. Verify with a slice test covering the write, the undo and the default deletion.
- [x] 1.4 Add the `_lastRemoteWriteAt` marker (type, initial value, rehydrate reset) and bump it in `StoreBridge.write`. Verify with a StoreBridge test that a peer entry bumps it and a local edit does not.

## 2. Automatic run path

- [x] 2.1 Thread `history` through `applyLayoutResultEdges` and `applyDiagramAutoLayout`. Verify with a test: a merged apply leaves `past` unchanged in length.
- [x] 2.2 Give `runAutoLayout` an `automatic` option (merged history, no fit, no success or no-op toast; the error toast kept). Verify by unit-testing the option mapping, or by review if it is too React-bound.
- [x] 2.3 Implement a pure `structuralSignature(snapshot)` (ids, parents, panel collapse, connection ends; texts excluded). Verify with tests: changes on add, remove, reparent, reconnect and collapse; stable on move, rename and label edits.
- [x] 2.4 Implement the `useAutoArrange` watcher (debounce 400 ms; skip undo/redo, remote writes, diagram switch, writes already laid out, disabled canvas; rebaseline after its own run) and wire it in `useCanvasController`. Verify with hook tests on a real store with fake timers: add → one run; burst → one run; undo → no run; remote marker → no run; manual mode → no run; layout-write-after-edit → no run.

## 3. Arrange menu

- [x] 3.1 Enable the Mode radio: Automatic arranges and saves through the settings path, Manual saves through `setDiagramLayoutSettings` without arranging. Restore defaults returns to manual. Verify with `ArrangeControl` tests.
- [x] 3.2 Add an "Auto" badge on the Arrange button in automatic mode and update the copy (en/pt-BR: mode hints, badge, how a manual move behaves). Verify with the i18n parity test and a component test.
- [x] 3.3 Document automatic mode in `docs/features.md`. Verify by review.

## 4. Integration checks

- [x] 4.1 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run fallow:check`. Verify all of them are green, and that the layout baselines are unchanged.
- [x] 4.2 Manual pass in `npm run dev`:
  - turn Automatic on;
  - add and connect elements and watch one smooth arrangement per burst;
  - check that one undo removes the element and restores the positions;
  - drag an element and check that it stays;
  - turn Manual on and check that nothing moves.

## 5. Revision: place only what was touched

- [x] 5.1 Measure full vs interactive vs incremental placement in `autoArrangeStability.experiment.test.ts`. Verify that the numbers are recorded in design decision 8.
- [x] 5.2 Implement `dirtyAfterEdit` and `placeIncrementally` (anchor column, slide past non-ancestor boxes in absolute coordinates, grow containers). Verify with `incrementalPlacement.test.ts`.
- [x] 5.3 Have the watcher hand on the accumulated dirty ids and skip edits that touch nothing. Have the canvas place them (`placeTouched`) with merged history and no ELK. Verify with `autoArrangeWatcher.test.ts`.
- [x] 5.4 Make the mode switch save-only in both directions, and update the hint copy (en/pt-BR) and `docs/features.md`. Verify with the `ArrangeControl` tests and the i18n parity test.
- [x] 5.5 Manual pass: in automatic mode, add and connect elements on an arranged diagram and check that nothing else moves.
