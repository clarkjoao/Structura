# Tasks

Prerequisite: `guided-overlay-fit-export` is implemented (overlay framing and read-only drawing).

## 1. Line of visibility

- [x] 1.1 Model: add `visibilityLaneOf(reading)` with the dangling and first-lane repair, and the `guidedSetVisibilityLine(diagram, laneId | null)` edit. Lane removal clears the line in the same edit. Verify: harness tests for set, move, remove, undo, deleting the lane, and moving the lane to the top.
- [x] 1.2 Add the lane context-menu command "Line of visibility above this lane" / "Remove the line of visibility", with en and pt-BR keys. Verify: a kind menu test showing which label appears on which lane, and that the first lane has no "above" option.
- [x] 1.3 Add `KindOverlay.lines` and the guided overlay line (LR and TB), drawn in `KindOverlayLayer` with labels. Verify:
  - overlay unit tests for coordinates on LR and TB, and an overlay with a line but no phases;
  - a KindOverlayLayer component test for the line and its labels;
  - nothing drawn in freehand mode.

## 2. Participants

- [x] 2.1 Model and edit: add `participantsOf` (trim, dedupe, drop the own lane, cap at 8 names of 60 characters each) and `guidedSetParticipants`. Verify: harness tests for add, remove, the cap, the own lane dropped, and undo.
- [x] 2.2 Inspector: add the `tags` section type to the contract, its rendering in `KindInspectorTab` (chips plus `KindSelectField`), and the guided "Participants" section that suggests the other lanes. Verify: component tests for adding from a suggestion, adding a new name, removing a chip, and the section list order.
- [x] 2.3 Canvas tag: add `KindMarker.tag` and `silent`, the `data-kind-tag` domAttribute and the CSS. Verify:
  - a checks test (tag text "+ A +1", silent, not counted);
  - a node overlay test for the attributes;
  - nothing in freehand mode.

## 3. Text

- [x] 3.1 Outline: parse `---` in the lane block (with the misplaced error) and participants in the prefix (`\,` escape), build them into kindData and kindProps, and serialize both. Verify:
  - outline tests for the spec scenarios;
  - a round trip with the line and participants;
  - the escaped-comma lane name.
- [x] 3.2 Mermaid: journey actors become participants, both exports carry participants and the line, and the swimlane import reads them back. Verify: round-trip tests for both formats, and the "Do work: 1: Me, Cat" scenario.
- [x] 3.3 Assistant: document `---` and participants in the guided prompt section. Verify: a prompt test.
- [x] 3.4 Docs: add Blueprint to `docs/concepts/diagram-kinds.md` (the line, participants, syntax, and the comma break). Verify: the docs cover all four, and prettier passes.

## 4. Integration

- [x] 4.1 Add a Cypress scratch tour: set the line on a lane and check the labelled line; add two participants from the tab and check the tag; paste "My working day" with `Me, Cat` and check the tag; switch to freehand and check both hide. Run `openspec validate guided-journey-blueprint`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
