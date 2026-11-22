# Tasks

## 1. Outline AST extensions

- [x] 1.1 Add `OutlineNode.ref?`/`shape?`, `OutlineJump.ref?`, the `fanout` item and `ParsedOutline.setAside?`. In `buildOutline`, resolve jumps by `ref` first (the `writtenByRef` map), use `shape` when set, and connect each `fanout` branch from the current open ends. Verify: the existing outline tests still pass, plus new build tests for a ref jump with duplicate names, a data/subprocess shape and a two-branch fan-out from a selected step.

## 2. Mermaid reader

- [x] 2.1 Add `guided.mermaid.parse.ts` with `isMermaid` (fence, front matter, `%%`, header) and the flowchart-family reader:
  - subgraph stack and lane names;
  - node shapes and quoted labels;
  - edge chains, labels and `&` groups;
  - the ignore-list;
  - per-line errors.

  Verify: unit tests on the swimlane documentation example, a `flowchart LR` with `&` groups and `-- label -->`, nested subgraphs, a node in two lanes, styling lines, and each error.

- [x] 2.2 Turn the graph into the AST:
  - a depth-first walk from the entries;
  - ref jumps for revisits;
  - exits for multi-edge nodes;
  - start-shaped entries dropped, keeping their edges;
  - end-shaped sinks.

  Verify: tests for convergence, a loop back, several entries (fan-out) and a start entry pasted after the existing start (still one start).

- [x] 2.3 Add the `journey` reader: tasks to a linear sequence, lane = first actor, `setAside` counts, and errors for a missing or out-of-range score. Verify: the "My working day" example, plus the error cases.

## 3. Mermaid writers

- [x] 3.1 Add `guided.mermaid.serialize.ts` with `serializeMermaidSwimlane` and `serializeMermaidJourney`. Verify:
  - a swimlane round trip on three fixtures (linear, converging decision, retry loop) through `build(new diagram, parse(serialize(d)))`, keeping lanes, names, kinds, connections and labels;
  - a journey export of a branching journey keeps the main path and the comment.

## 4. Capture and panel

- [x] 4.1 Dispatch on `isMermaid` in `guidedTextCapture.build`. Add `formats` to `KindTextCapture` and the guided kind. Map Mermaid errors and the set-aside summary to i18n keys. Verify: `textCapture` tests, and the `pasteKindText` tests for a fenced swimlane block and a journey block.
- [x] 4.2 In `KindTextPanel`, turn copy into a menu with the formats, and add a syntax hint line that mentions Mermaid. Verify: a component test that copies each format (clipboard mock), and the summary showing the set-aside note for a journey block.

## 5. Assistant, i18n, docs

- [x] 5.1 Add the Mermaid paragraph to the guided section in `prompt-builder.ts`. Verify: a prompt test asserting the paragraph on guided diagrams only, and a `journey-outline` test that applies a valid swimlane block and drops an invalid one with its errors.
- [x] 5.2 Add the en/pt-BR keys and extend `i18n-coverage.test.ts` with the Mermaid error codes. Document import and export in `docs/concepts/diagram-kinds.md`. Verify: the coverage test passes.
- [x] 5.3 Add a Cypress scratch tour: paste the swimlane example on a new guided diagram, check the steps sit in their lanes and that the decision exits are labelled, copy as Mermaid swimlane, undo. Then run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
