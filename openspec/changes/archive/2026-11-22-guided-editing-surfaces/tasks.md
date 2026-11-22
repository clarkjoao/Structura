# Tasks

## 1. Contract

- [x] 1.1 Add `inspector?` (tab, hiddenFields, sections as data) to `DiagramKindDescriptor`, and `primary?` to `KindElementRef`. Add the host helper `kindInspectorFor(diagram, component)`, gated by `isKindActive`. Verify: unit test showing it returns nothing for freehand mode, lanes and notes.

## 2. Guided edits

- [x] 2.1 Add `guidedChangeShape` with its refusals (`endHasNoNext`, second start). Verify: harness tests for step→decision, a decision with exits →end (refused), a second start (refused), and one undo.

## 3. Inspector

- [x] 3.1 Add the `"kind"` tab to `TabBar` and the default choice in `ComponentPanel`. Verify: a component test showing a guided step opens on Journey and a freehand diagram has no such tab.
- [x] 3.2 Add `guided.inspector.ts` (Lane, Step kind, Exits) and the host's `KindInspectorTab` and register it on `guided.kind.ts`. Remove `KindActionsSection`. Verify: component tests for the lane move (undo), the shape change and refusal notice, and the exit label commit.
- [x] 3.3 Hide `hiddenFields` in Details. Verify: a component test showing no Technology, Type or Shape on a guided step in kind mode.

## 4. Insert surfaces

- [x] 4.1 Add `kindCatalogFor`. Have `QuickInsertPopover` use the kind section, filter recents, drop empty sections, and pass the connection source to the kind insert. Verify: component tests for the empty field in guided mode, a dropped connection and the freehand case.
- [x] 4.2 In `CanvasBottomToolbar` kind mode, show the primary buttons and a "More" menu instead of C4/Flowchart. Verify: component tests for guided and freehand.

## 5. i18n and wrap-up

- [x] 5.1 Add the en/pt-BR keys and extend `i18n-coverage.test.ts`. Verify: test passes.
- [x] 5.2 Add a Cypress tour step: select a step, open Journey, move lanes, change it to a decision, label an exit, and insert from the toolbar and from a dropped connection. Verify: the scratch spec passes.
- [x] 5.3 Run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.

## 6. Follow-up

- [x] 6.1 Add a "New lane" option to the lane section (`guidedMoveStepToNewLane`, one undo step), and remove the lane menu from a step's floating bar (`KindQuickActions`). Verify: component tests for the new lane and undo, and for the empty floating bar on a step.
