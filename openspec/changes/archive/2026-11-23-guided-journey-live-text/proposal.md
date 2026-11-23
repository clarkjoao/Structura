# Proposal

## Why

Today a guided journey's text is one-way: "write as text" only _adds_ an outline after the selection, and "Copy as…" only exports. Renaming five steps, reordering a branch or deleting a phase from text is impossible. Mermaid's main strength is that the text _is_ the diagram: you edit a line and the drawing follows. This change gives guided journeys that, while keeping the canvas as an equal editor.

Item 4 of the follow-ups, the assistant reviewing changes before they apply, needs the same engine: text in, a per-step change list out.

## What Changes

- **The panel edits the whole journey.** The "Text" panel opens with the whole journey written as an outline, editable.
  - Applying (button or Ctrl/Cmd+Enter) turns the _difference_ into one guided edit: renamed steps, changed kinds, scores and phases, lane moves, added and removed steps, and changed exits. Positions are never taken from text.
  - Before applying, the panel shows the change count (`+2 ~3 −1`), and a "Review" list with one line per change.
- **Steps keep their identity across edits.** The panel remembers which line is which step, so a rename stays a rename and keeps the step's position, comments, links and version history.
  - **Inside the panel,** the panel tracks this itself; the text carries no ids.
  - **Outside the panel** (pasted or written by the assistant), a step MAY carry an explicit handle, `Paga {#s4}`.
  - **"Copy as… Text with ids"** writes those handles.
- **Canvas to text.** While the panel is open and the text is untouched, the text follows canvas edits. If both changed, the panel says so, keeps your edits and offers "Reload from the diagram".
- **What the text does not hold is kept.** Applying never removes:
  - steps unreachable from the start;
  - extra connections the outline cannot write;
  - lanes, notes and texts.
- **"Add after the selection" stays.** It remains reachable as the canvas paste and as a panel action, "Insert at the selection".

## Non-Goals

- Live apply on every keystroke. Applying stays an explicit, single undo step.
- Renaming or deleting lanes from the text. Lanes are managed on the canvas and in the Journey tab, and a new lane name still creates a lane.
- Collaborative text editing (a shared cursor in the panel). The canvas stays the collaboration surface.
- A Monaco editor. The panel stays a plain text area.
- Editing Mermaid in place. Mermaid remains import and export through the existing paths.

## Capabilities

### New Capabilities

- `guided-journey-text-sync`: covers
  - the whole-journey text panel;
  - how edited text turns into a guided edit (the change list);
  - step identity across edits, including handles;
  - what the text never removes.

### Modified Capabilities

- `guided-journey-outline`:
  - the "write as text" panel requirement changes, from add-only to the whole journey with insert as a secondary action;
  - the outline format gains the optional `{#handle}` suffix.

## Impact

- `src/features/diagram-kinds/guided`:
  - new pure modules: a text-diff module that aligns lines and builds the change list, and a reconcile module that turns the change list into a `KindEdit`;
  - parse support for `{#handle}`;
  - a serialize option for handles and for the line→step map.
- `src/features/diagram-kinds/kind.types.ts`: `KindTextCapture` gains `reconcile(ctx, baseText, editedText, lineIds)` alongside `build`.
- `src/features/canvas/chrome/KindTextPanel.tsx` and `kindTextCapture.ts`: panel modes, the change review and the stale-text banner.
- i18n (en, pt-BR) for the review lines, the banner and the actions.
- No data model change. Handles are text-only, and nothing new is stored.
