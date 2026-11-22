# Tasks

## 1. Kind fields on the diagram

- [x] 1.1 Add `kind?`, `kindMode?` and `kindData?` to `Diagram` with guards (`hasKind`, `isKindFreehandMode`); verify with a unit test that a diagram without them hashes identically to before
- [x] 1.2 Implement `sanitizeKindFields` (keep a well-formed unregistered kind, drop a malformed kind/mode/data, cap `kindData` at 64 KB) and call it from JSON import, folder sync, share-link decode, collab snapshot adoption and duplication; verify with tests for "Missing plugin kind" (kept through load → edit → save) and "Malformed kind"
- [x] 1.3 Verify that the kind fields round-trip unchanged through Versions (copy-on-write) and the folder file format, using a fixture test per path

## 2. Kind registry and policy

- [x] 2.1 Create `features/diagram/kinds/` with the `DiagramKindDescriptor`, `KindContext`, `KindEdit`, `KindIssue`, `KindMarker` and `KindCommand` types and a registry that validates id format, duplicates and a required `conforms`; verify with registry tests for "Duplicate id is refused" and the invalid-id cases
- [x] 2.2 Implement the `KindEdit` applicator on the same change vocabulary and code path as plugin `applyChanges`; verify with a test that one `KindEdit` and the equivalent `PluginDiagramChanges` produce the same diagram
- [x] 2.3 Implement `resolveKindPolicy(diagram)` (the four rows of design D3), memoised by diagram id and registry version, plus a guard test that no file outside `kinds/` reads `diagram.kind`; verify with policy unit tests and the guard test
- [x] 2.4 Verify the zero-kind baseline: with the registry empty, the existing canvas, store and export test suites pass unchanged, and the new-diagram dialog shows no kind choice
- [x] 2.5 Write ADR-0014 "Diagram kinds" (kind = metadata over ordinary content, the contract, the plugin-safety rules, relation to vision §8–9) and update the Diagram types, Validators and Layout providers rows in `docs/architecture/extension-points.md`; verify links resolve from `docs/adr/README.md`

## 3. Post-edit hook and compatibility with existing writers

- [x] 3.1 Add the kind watcher (modelled on `autoArrangeWatcher`): on a structural signature change of the active diagram in kind mode it runs `derive` then `arrange` and writes both without history; undo/redo and remote writes only rebaseline; on open it arranges once when `kindData.arrangedSignature` differs; verify with watcher tests using a stub kind for a local edit, a plugin `applyChanges`, an undo (no run) and a simulated remote write (no run)
- [x] 3.2 Make plugin `moveComponents` and `applyChanges` moves return `{ refused: "kind_controls_layout" }` and change nothing when the policy is not draggable; bump `STRUCTURA_PLUGIN_API_VERSION` to 1.16.0; verify with `diagram-api.test.ts` cases for "Plugin moves a step" and "Plugin adds a step" (stub kind), plus an unchanged freehand case
- [x] 3.3 Add `kind`, `kindMode` and `kindAvailable` to plugin `DiagramSnapshot` and `appliesTo?: { kinds?: string[] }` to `PanelContribution`, with manifest/contribution validation; verify with `plugin-registry` tests for "Panel scoped to a kind" and an unscoped panel showing everywhere
- [x] 3.4 Verify that a plugin-created diagram (`createDiagram`) is freehand, with a plugin API test

## 4. Mode switch and round trip

- [x] 4.1 Add store actions `editKindFreehand` and `returnToKind` (conformance → restore mode, arrange and derive in one checkpoint; on failure, change nothing and return the issues); verify with slice tests for "Freehand switch moves nothing" and the conform / not-conform round trips using a stub kind
- [x] 4.2 Add the "Edit freehand" / "Back to <kind>" control, the unavailable-kind notice and an issues list whose rows select their element, with i18n keys in en + pt-BR; verify with component tests and the i18n coverage test
- [x] 4.3 Add the kind choice to the new-diagram dialog (Freehand preselected, creatable registered kinds listed, `create` applied as part of creation); verify with a component test for "Default stays freehand"

## 5. Guided kind: domain

- [x] 5.1 Implement guided `conforms` (the rules in guided-flow-authoring, with lane order read along the cross axis); verify with tests for "Two starts", "Lanes reordered by hand", a cloud element outside lanes, and an unknown (plugin-missing) element
- [x] 5.2 Implement guided `create` (two localized lanes, start step, `kindData.flowId`); verify with a test for "Creating a guided diagram" in both locales
- [x] 5.3 Implement `deriveGuidedFlow` keyed by `componentId`, with content preserved and steps removed, and recreating a missing flow; verify with tests for "Derivation after Tab", "Decision becomes a condition", "Payload survives an insert", "Derived flow missing" and `checkFlowInvariants`
- [x] 5.4 Implement guided edits as `KindEdit` builders: lane add, rename, move and remove-with-rehoming (with the last-lane guard), add-next (append, insert, decision exit), add-branch, move-to-lane, and delete-and-sew (with the start refusal); verify with tests for each scenario in guided-flow-authoring

## 6. Guided kind: lane-banded arrangement

- [x] 6.1 Implement the order pass (longest-path layering with back-edges left out, design D6 revised); verify layers 0,1,2 on a three-lane linear fixture
- [x] 6.2 Implement the placement pass (bands, stacks, lanes spanning all columns, density and gaps); verify with tests for "Two exits in one lane" and "Spacious"
- [x] 6.3 Mirror top-to-bottom from one along/across placement (no per-axis branch), leaving edges to the fixed-side routing; verify with direction tests in both axes
- [x] 6.4 Add a stability test (the longest-path layering needs no column floor); verify that an append moves 0 steps and an insert moves only later steps
- [x] 6.5 Measure 100 and 300 step fixtures; verify ≤ 50 ms at 100 steps and record the numbers in design.md

## 7. Guided kind: canvas experience

- [x] 7.1 Apply the policy on the canvas: non-draggable and non-resizable nodes in guided mode, no Manual/Automatic choice in the Arrange menu; verify with "Drag does nothing" (no history entry) and an Arrange menu test
- [x] 7.2 Declare the guided keymap as `commands` and bind kind commands in the canvas keyboard layer with focus, selection and editor guards, plus inline label edit on the new step; verify with interaction tests and that `Tab` moves focus when nothing is selected
- [x] 7.3 Filter the palette and quick insert by `elements` and insert into the selected lane, connected from the selected step; verify with "No architecture nodes" and an insert-into-lane test
- [x] 7.4 Add swimlane header controls and the inspector lane field plus "Move to lane" in the context menu (en + pt-BR); verify with component tests
- [x] 7.5 Render guided `checks` as markers through the identity-cached projection; verify with "Unlabelled exit" and that the viewer and exports show none
- [x] 7.6 Show the derived flow in the flows panel read/play only in guided mode and as an ordinary flow in freehand mode; verify with FlowPanel tests for both modes and "Recorded flow survives the return"
- [x] 7.7 List the guided shortcuts in the shortcuts dialog (en + pt-BR); verify with the i18n coverage test

## 8. Docs and integration

- [x] 8.1 Write `docs/concepts/diagram-kinds.md` (contract, policy table, post-edit hook, compatibility rules, guided as the reference kind, known limits) and update `docs/architecture/vision.md` §8–9 (there is no concepts index; the page is linked from ADR-0014 and the vision); verify the links resolve
- [x] 8.2 Add a Cypress check (`cypress/e2e/guided-diagram-smoke.cy.ts`): a seeded guided diagram, a journey with a decision across three lanes built by keyboard only, no drag while guided, a drag in freehand mode, and the arrangement taking over on the return; verify it passes against `vite preview` (top-to-bottom and the viewer are covered by the layout and import unit tests)
- [x] 8.3 Verify a walkthrough scene on the derived flow plays the updated sequence after an insert (walkthrough playback test)
- [x] 8.4 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` and `npm run fallow:check`; verify all are green
- [x] 8.5 Run `openspec validate guided-flow-diagram` and verify it passes
