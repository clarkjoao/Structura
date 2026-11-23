# Design

## Context

What exists today:

- **`serializeGuidedOutline`** writes the journey from the start step:
  - lanes are declared first;
  - the start step itself is not written;
  - revisits become jumps (`@name`);
  - unreachable steps and inexpressible connections are counted in a trailing comment.
- **`parseOutline` → `buildOutline`** produce an _additive_ `KindEdit` placed after the selection.
- **`KindEdit`** already has everything a reconcile needs:
  - `remove`, `disconnect`, `update` (name, flowShape, kindProps);
  - `add`, `connect`, `reconnect`, `reparent`, `relabel`.
- **`KindTextPanel`** is a textarea popover, checked on a 150 ms debounce against the diagram and the selection.

## Goals / Non-Goals

**Goals:**

- Identity survives edits typed in the panel without visible ids.
- The reconcile is a pure function, `(diagram, base, edited, lineIds) → KindEdit + change list`. The assistant-revisions change reuses it.

**Non-Goals:**

- A real text editor (Monaco) or syntax highlighting.
- Three-way merge of text edits made by two people.

## Decisions

### 1. Identity by line alignment, with optional handles

When the panel serializes, it also returns `lineIds: (stepId | null)[]`, one entry per line. On apply, a line diff (Myers, on trimmed line text) aligns the base text with the edited text:

- **Equal lines** keep their id.
- **A replace hunk** (n removed, m added) pairs lines 1:1 in order, up to min(n, m), and keeps those ids. This is what makes an in-place rename or rescore keep the step. The extra lines are adds or removes.
- **A trailing `{#handle}`** overrides the alignment. Handles come from "Copy as… Text with ids", and the panel keeps the handle→id map of the text it last wrote.

_Alternative considered:_ Monaco tracked decorations, which follow lines invisibly, even through cut and paste. They are more robust, but add a heavy lazy editor to a popover for one gain (moved lines), and handles already cover moved lines. Rejected for now.

_Known limit:_ cutting a line without a handle and pasting it elsewhere becomes remove + add. The review list makes this visible ("Remove “B”", "Add “B”"), and handles avoid it.

### 2. Reconcile through the existing parser, with one tree

The edited text is parsed by the existing `parseOutline`, which gains handle support, into the outline AST. Each AST node gets its resolved step id from the alignment, or none if it is new. The reconcile then walks the AST the way `buildOutline` does, but against the existing diagram:

- **Node with an id:** emit an `update` for its name, kind, score and phase only when they changed, and a `reparent` when the lane changed.
- **Node without an id:** emit an `add`, through the same `KindNodeInput` path as `buildOutline`, so lane creation and kindProps merging are shared.
- **Edges:** the desired edge set is collected as `(sourceId, targetId, label)` and compared with the current set _restricted to the edges the outline can express_. That covers edges written in the base text, which the serializer tracks. The result becomes `connect`, `disconnect` and `relabel`.
- **Removals:** an id present in the base `lineIds` but absent after alignment becomes a `remove` (removing a step also removes its connections in the existing slice).

The build and the reconcile share the AST walk. `buildOutline` becomes the special case "no ids, attach after the selection".

### 3. What is protected

The serializer already knows what it omitted. It returns `protectedIds`: unreachable steps, the start step, and the extra edges of non-decision steps. The reconcile never touches those. Lanes are only ever added.

### 4. Stale base

The panel keeps `base` (text, lineIds and the diagram snapshot reference).

- **Not dirty:** a snapshot change re-serializes.
- **Dirty:** a snapshot change shows the banner. Apply then reconciles the edited text against the _current_ diagram, using the old base's ids. Changes whose id no longer exists are skipped and counted, and the edges of a skipped node are skipped with it.

### 5. Contract change

`KindTextCapture` gains:

- `serializeWithIds(diagram, ctx) → { text, lineIds, handles, protectedIds }`;
- `reconcile(ctx, base, editedText) → { edit, changes: KindTextChange[] } | { errors }`.

`KindTextChange` is data: kind of change, step name, before and after. The panel renders it, and the assistant card (next change) renders it with checkboxes. Kinds without a `reconcile` keep the add-only panel.

## Risks / Trade-offs

- **[Risk]** A replace hunk pairs the wrong lines, for example after deleting one line and rewriting another nearby. → **Mitigation:** the review list shows what will happen before applying, and pairing is preferred only when a lane or name similarity exists. Tests cover the common edits: rename, rescore, insert, delete, swap two lines.
- **[Risk]** Large journeys (300+ steps). → The Myers diff over lines is O(ND), which is fine for this size. The serialize is already used by the assistant prompt. A performance test is in the tasks.
- **[Risk]** Users expect lane renames from the text. → Lane renames are documented as a non-goal, and an unknown lane prefix creates a lane, as it does today.

## As implemented

- **Alignment.** It is an LCS line diff, not Myers; on these sizes they give the same result. A last pass re-binds a line moved unchanged to its step, so a cut-and-pasted line keeps its identity even without a handle.
- **What a text may change.** Instead of `protectedIds`, `writeGuidedOutline` returns `writtenConnections`, the connections the text writes. Only steps with a line in the base, and only those connections, can be changed. Everything else is out of reach by construction.
- **The walk is not shared.** `reconcileOutline` has its own walk of the outline tree instead of factoring `buildOutline`'s: one anchors after the selection and the other rebuilds against existing ids, and sharing the walk added more branching than it saved. The two follow the same rules, and both test suites cover them.
- **A lane carries over.** A lane named on a line holds for the lines after it, exactly as in the outline format. Moving one step to another lane in the text therefore also moves the following unprefixed lines, which the review list shows.
