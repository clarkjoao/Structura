# Tasks

## 1. Outline parser

- [x] 1.1 Add `guided.outline.parse.ts`. It turns text into an AST: sequence, step, decision with exits, end step and jump, each with its line and lane name. It applies the indentation stack, the `\:` escape and `→`/`->`, and collects errors per line. Verify: `guided.outline.parse.test.ts` covers every line form, nesting, comments and blank lines, and each structural error in the spec (exit outside a decision, decision without exits, indentation under a step or end, empty name).
- [x] 1.2 Add a summary helper: lane names, step, decision and end counts, for the panel. Verify: unit test on a mixed outline.

## 2. Builder (outline → KindEdit)

- [x] 2.1 Add `guided.outline.build.ts`, which resolves lanes. A name matches an existing lane trimmed and case-insensitively; otherwise new lanes are added in order of first appearance. Lines without a lane inherit the previous one, and the first falls back to the first lane. Verify: harness test "a lane prefix that matches no lane creates it after the existing lanes".
- [x] 2.2 Build steps, decisions, exits and convergence from the open-ends set, and resolve jumps (latest outline step first, then unique existing steps), with errors for unknown or ambiguous targets. Verify: harness tests for a linear journey, two converging exits, a closed path (`!`), a retry jump, an unknown jump and an ambiguous jump.
- [x] 2.3 Resolve the anchor, mirroring Tab:
  - a selected step with one exit, or with none;
  - a selected decision (the outline becomes a new exit);
  - a selected end step (refused with `endHasNoNext`);
  - no selection (end of the main path, or before its end step).

  Verify: harness tests for each case, including A → X → Y → B.

- [x] 2.4 Check that adding an outline is one undo step and that the arrangement and derivation follow. Verify: harness tests "undo once restores the diagram" and "the derived flow includes the new steps, and steps sit inside their lanes".

## 3. Serializer and round trip

- [x] 3.1 Add `guided.outline.serialize.ts`. It walks depth-first from the start step and writes:
  - lane prefixes where the lane changes;
  - indented exits;
  - convergence dedented after the decision block;
  - back-edges as `-> @name`;
  - a translated comment counting the unreachable steps it left out.

  Verify: unit tests on fixture journeys.

- [x] 3.2 Add a round-trip test: `build(new guided diagram, parse(serialize(d)))` keeps lanes, names, step kinds, exit labels and connections, on at least three fixtures (linear, converging decision, retry loop). Verify: test passes.

## 4. Kind hook

- [x] 4.1 Add an optional `textCapture` hook (`parse`, `apply`, `serialize`) to `DiagramKindDescriptor` in `kind.types.ts`, and implement it in `guided.kind.ts`. Add a host helper that returns it only in kind mode, using `resolveKindPolicy`. Verify: `registry.test.ts` and `kind-reads.guard.test.ts` still pass, and a new test shows the helper returns nothing for a freehand diagram or a guided diagram in freehand mode.
- [x] 4.2 Add the en and pt-BR keys under `diagramKinds.guided.outline.*`: errors, summary, panel labels, the notice and the comment. Add `endName` if missing. Verify: `i18n-coverage.test.ts` passes.

## 5. Write-as-text panel

- [x] 5.1 Add an `OutlinePanel` popover from a "Text" button in `KindModeBar`, shown only when `textCapture` is available. It has:
  - a textarea, re-parsed with a 150 ms debounce;
  - errors listed by line;
  - a summary;
  - Apply, disabled while there are errors;
  - Ctrl/Cmd+Enter to apply;
  - "Copy as text".

  On apply it clears and selects the last added step. Verify: component test covering errors, the disabled Apply, the keyboard apply and the selection.

- [x] 5.2 Add a Cypress tour step: open a new guided diagram, type a five-line outline with a decision, apply, then check the steps sit in their lanes and one undo removes them. Verify: the Cypress spec passes, using the scratchpad spec copied into `cypress/e2e` temporarily, as in the guided tour.

## 6. Canvas paste

- [x] 6.1 Add a plain-text branch to the native `paste` handler. It runs after the image and SVG checks, and only when:
  - the event's target is not editable;
  - `textCapture` exists;
  - the text parses with no errors and has at least two step lines.

  It prevents the default and marks the paste consumed, then shows a toast with the count and an Undo action. Verify: hook test for a valid outline (steps are added, the keyboard Ctrl+V path is skipped), a single line and text with an error (both keep the existing behaviour), and a freehand diagram (nothing is added).

## 7. Assistant

- [x] 7.1 Add an `add_journey_outline` tool to `tools.ts`, offered only when `textCapture` exists for the active diagram. It applies through the same hook and returns `{added}` or `{errors}`, changing nothing on errors. Verify: `store.test.ts`-style tests for a valid outline, an invalid outline and the tool's absence on a C4 diagram.
- [x] 7.2 In `prompt-builder.ts`, add the outline format section and the current journey (`serialize`, capped at 300 lines with a truncation comment) for guided diagrams only. Verify: prompt-builder test snapshot for a guided diagram and a check that freehand diagrams have no such section.

## 8. Docs and wrap-up

- [x] 8.1 Document the format in an "Outline" section of `docs/concepts/diagram-kinds.md`, with an example in pt-BR and the escape rule. Verify: the doc is reviewed.
- [x] 8.2 Run the full checks: `openspec validate guided-journey-text-capture`, vitest, typecheck, lint and fallow. Verify: all pass, and any warnings are pre-existing.
