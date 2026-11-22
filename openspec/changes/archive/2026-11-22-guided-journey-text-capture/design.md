# Design

## Context

The guided kind (ADR-0014, change `guided-flow-diagram`) authors through `KindEdit`. That is a key-addressed edit vocabulary (`add` / `connect` / `reconnect` / `move` / `kindData` …), applied by `applyKindEdit`:

- `add` entries can name other keys of the same edit as their `parent`. `guidedCreate` already parents the start step to a lane key.
- After any structural edit, `watchDiagramKind` re-derives the flow (`deriveGuidedFlow`) and re-arranges (`arrangeGuided`). It writes no history, inside the edit's undo step. Provisional positions in the edit only need to be sane; the arrangement replaces them.
- Tab (`guidedAddNext`) shows the insertion pattern. It reconnects the selected step's single exit to the new step, then connects the new step to the old successor.

The assistant (`src/features/llm`) uses a JSON tool list (`tools.ts`) and a prompt (`prompt-builder.ts`), and has no kind awareness today. Canvas paste is handled by `useCanvasMediaPaste` (native `paste`: images, SVG) plus the keyboard Ctrl+V path (internal clipboard).

## Goals / Non-Goals

**Goals:**

- One pure pipeline: `parse(text) → Outline AST + errors`, then `build(diagram, outline, anchor, ctx) → KindEdit | refused`, then `serialize(diagram) → text`. All three surfaces (panel, paste, assistant) call it, so the rules live in one place.
- Building is deterministic and needs no DOM, so it is unit-testable through the existing `guidedHarness`.

**Non-Goals:**

- Reconciling an outline with existing steps (see the proposal).
- An incremental or streaming parser: outlines are short (tens to hundreds of lines), so we reparse on every keystroke.

## Decisions

### 1. Line-based grammar with an indentation stack, not a general parser

Each line is classified by regex after trimming its indentation: comment, exit (`label ->`), jump (`-> @`), then the optional `Lane: ` prefix, then the `?` and `!` markers. Nesting comes from an indentation stack, like a Python-style outline. The indentation width is whatever the line's leading whitespace is, with a tab counted as 2 spaces, compared against the stack.

- **Why:** the format is meant to be typed by people in a meeting. A PEG or grammar library would add a dependency for no gain.
- **Alternatives considered:**
  - Mermaid `flowchart` syntax: too verbose to type live, and it has no lanes except subgraphs.
  - YAML: indentation-sensitive in a less forgiving way, with quoting pitfalls.

### 2. AST first, then a builder that resolves against the diagram

- **AST.** `parse` yields a tree: `Sequence = Item[]`, where `Item = Step | Decision{exits: {label, body: Sequence}[]} | End | Jump`. Each item carries its `line` and an optional `lane` name.
- **Builder.** `build` walks the tree, keeping the set of open path ends (`Set<key | existingId>`):
  - A step connects every open end to itself, and then becomes the only open end.
  - A decision fans out into its exits. The open ends after its block are the union of the exits' open ends (convergence).
  - An end step or a jump closes its path.
- **Jumps.** Jumps resolve against an outline-local `name → key` map (latest wins), then against unique existing step names. Errors are collected with their line numbers; any error means the result is `{ errors }` and no edit.
- **Why split:** the panel needs the errors and the summary (lanes, steps, decisions) without building against the diagram on every keystroke. The diagram-dependent checks (jump targets) run in `build`, which is cheap. The panel calls both, debounced 150 ms.

### 3. Anchor resolution mirrors Tab

- **Selected step:**
  - If it has exactly one exit, that exit is `reconnect`ed to the outline's first item. Each open end of the outline is then connected to the old successor.
  - If it has no exit, the outline is appended after it.
- **Selected decision:** the outline's first item is attached as a new exit, unlabelled, as Tab does.
- **Selected end step:** refused with the existing `endHasNoNext` notice.
- **No selection:** the anchor is found by walking the main path from the start (each decision's first exit, stopping at a cycle). If the walk ends on an end step, the outline is inserted before it, using the same reconnect logic.
- **Why:** the user already knows what Tab does, so the outline should behave the same way.

### 4. New lanes and provisional positions

- **New lanes.** Unknown lane names become `add` entries, with keys `outline-lane-N`. They use the same input shape as `guidedAddLane`: swimlane panel, orientation from the direction, colour from the index. Positions are stacked after the last lane.
- **Steps.** Steps get positions along the axis (`index × column`) inside their lane's frame. `arrangeGuided` re-packs everything right after; we only make sure no step starts outside its lane.
- **Lane order.** `kindData.laneOrder` is left alone. `orderLanes` slots unnamed lanes by position, and the derivation then normalises the stored order.

### 5. Names, not translations, in the syntax

- **Syntax.** The markers (`:`, `?`, `!`, `->` / `→`, `@`, `#`) are fixed in every language.
- **Default names.** An empty name is an error, except after `!`, where it falls back to `t("diagramKinds.guided.endName")`. If that key does not exist, it is added.
- **Shapes.** Steps use the `rectangle` shape, decisions `diamond` and ends `end`.

### 6. The serializer writes revisits as jumps

- **Walk.** The serializer does a depth-first walk from the start step over `readGuided(diagram).outgoing`, keeping exits in reading order. Lanes are declared first (`Lane:` lines), so a round trip keeps their order.
- **Revisits.** A step reached a second time, whether by a convergence or a retry, is written `-> @name`. A dedented convergence line would read better, but it is only correct when every branch is open and meets at the same step. Detecting that (post-dominators, plus branches that end open without an end step) is fragile, while jumps reproduce exactly the same connections. _Changed during implementation; the parser still accepts dedented convergence._
- **Duplicate names.** A jump resolves to the latest earlier line with that name, which in a depth-first walk is the step written.
- **Lane prefixes.** The prefix is written whenever the lane changes from the previous line.
- **Round trip.** Tested on fixture journeys (linear, converging decision, retry): `build(new diagram, parse(serialize(d)))` gives the same lanes, steps, labels and connections.

### 7. One edit, one history entry

Panel, paste and assistant all apply through `applyKindEdit(edit)` with the default history behaviour: one `pushHistory` before mutating. Derive and arrange then follow in the watcher, without history. Nothing new is needed in the store.

### 8. Surfaces

- **Kind descriptor.** A new optional hook on the descriptor: `textCapture?: { build(ctx, text) → KindTextBuild | refused | { errors }, serialize(diagram, ctx), syntax, placeholder }`. `build` is pure and does the parse, so the panel, the paste and the assistant share one call. The host helper `kindTextCaptureFor` (in `diagram-kinds/textCapture.ts`) returns it only in kind mode.
  - The canvas and the LLM call it without importing the guided internals, which keeps the `kind-reads.guard` boundary.
  - The hook is only consulted when `resolveKindPolicy` is in kind mode.
- **Panel.** A popover anchored to a "Text" button in `KindModeBar`, with a textarea, an error list, a summary, Apply and "Copy as text".
  - A popover keeps the canvas visible behind it.
  - A modal was rejected, because the user wants to see where the steps land.
- **Paste.** One new branch in the native `paste` handler, run only after the image and SVG checks. It runs only when the event's `text/plain` is present, the target is not editable, and `textCapture.parse` returns no errors and at least two step lines.
  - It calls `preventDefault`, and sets the consumed ref so the keyboard Ctrl+V path skips.
- **Assistant.**
  - **Tool.** `add_journey_outline` is listed in the prompt only when `textCapture` exists for the active diagram. It takes `{ outline: string, afterStepId?: string }` and becomes an `ADD_JOURNEY_OUTLINE` patch action.
  - **Checking.** The action is checked against the diagram when the reply arrives. An invalid outline is dropped from the suggestion, and its per-line errors are appended to the assistant's message, which is where the next turn sees them, since this assistant has no tool-result loop. A valid one is applied on Accept, like `insert_pattern`, and reports `{ added }`.
  - **Prompt.** `prompt-builder` gets a short format section with one example, plus `serialize(diagram)` as the current journey.

## Risks / Trade-offs

- **Ordinary text read as an outline.** Pasted text can look like an outline by accident (for example, two lines of prose) and silently become steps. Mitigations:
  - at least two step lines;
  - no errors;
  - one undo removes it;
  - a toast "N steps added from text" with an Undo action.
    The toast is informational, so it does not break the no-prompts rule.
- **`:` inside names.** A colon in a step name ("Status: pago") would read as a lane prefix. Mitigations:
  - a prefix counts as a lane only when it matches an existing lane or is followed by more text;
  - the lane is created otherwise, so the panel's summary shows "1 new lane", and the user sees it before applying;
  - documented: write `\:` to escape.
- **Duplicate step names** make jumps ambiguous. Ambiguity against existing steps is an error, and inside the outline the latest wins.
- **Assistant cost.** A large serialized journey in the prompt costs tokens. It is capped at 300 lines, with a trailing comment when truncated.

## Migration Plan

Additive only. No stored data changes, and nothing needs migrating. Rollback means reverting the change. Diagrams created through an outline are ordinary guided diagrams.
