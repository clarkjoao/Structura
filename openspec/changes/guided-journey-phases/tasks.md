# Tasks

Prerequisite: `guided-journey-experience` (part 2) is implemented.

## 1. Model

- [x] 1.1 Add `phaseStarts`, `phaseOf` and a shared `readingOrder` in `guided.model.ts`, and `guidedSetPhaseStart` in `guided.edits.ts`. Verify: harness tests for inheritance along a sequence, a branch, convergence (latest phase wins), removing a start, and undo.

## 2. Arrangement

- [x] 2.1 Add phase floors to the layering with relaxation, and phase starts in `guidedArrangeKey` (the band takes no room: it is drawn beside the lanes, see design). Verify: layout tests showing contiguous columns (the short-branch scenario), no change without phases, determinism, TB, and a 300-step journey with 6 phases staying within budget.

## 3. Overlay

- [x] 3.1 Add `overlay` to the kind contract and `guided.overlay.ts` (bands, separators, curve along the main path). Verify: unit tests on coordinates for LR and TB, the curve values and tones, and null without phases or scores.
- [x] 3.2 Add `KindOverlayLayer` (`ViewportPortal`, SVG), memoised on the snapshot, with segment click to select. Show it in kind mode on editable canvases only. Verify: a component test for the segments, the click selection, and nothing in freehand mode.

## 4. Inspector, text and Mermaid

- [x] 4.1 Add the Phase section to the Journey tab. Verify: a component test showing that typing a name adds a phase and clearing removes it.
- [x] 4.2 Add outline `##` phase lines (parse, its error, build, serialize). Verify: outline tests for the meeting-notes scenario and a round trip with phases.
- [x] 4.3 Mermaid: journey sections become phase starts, the export writes one section per phase, and the swimlane `%% phases:` comment is written and read back. Verify: the "My working day" round trip keeps its sections, and a swimlane round trip keeps the phases.
- [x] 4.4 Assistant: document `## Phase` in the guided prompt section. Verify: a prompt test.

## 5. Wrap-up

- [x] 5.1 Add the en/pt-BR keys, extend i18n coverage, and update the docs. Verify: the coverage test passes.
- [x] 5.2 Add a Cypress scratch tour: paste "My working day", check the band shows two phases and the curve dips at "Do work", start a phase from the tab, and switch to freehand to see the band hide. Then run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
