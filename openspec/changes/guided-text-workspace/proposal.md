# Proposal

## Why

The text panel is a popover. It covers part of the canvas, closes when the canvas is clicked, and you cannot see which line is which step. For a journey that is written as text and checked on the canvas, the text should sit beside the canvas and stay open while you work. Each line should be tied to its step, and the editor should help you type names that already exist.

## What Changes

- **Dock the panel.**
  - The Text panel can be docked: "Dock beside the canvas" turns it into a resizable column on the canvas's left. The choice is remembered per browser, in a per-viewer preference.
  - Docked, it stays open while you select and edit on the canvas, and follows the diagram as the popover does.
- **Line and step stay together.**
  - Moving the cursor to a step's line selects that step on the canvas and brings it into view.
  - Selecting a step on the canvas highlights its line in the text and scrolls to it.
- **Autocomplete.** The panel suggests:
  - existing lane names after a line's start, ending with `: `;
  - step names after `@`;
  - phase names after `## `.

  Tab or Enter accepts a suggestion, and Esc closes the list.

- **Errors in place.** Lines with an error get a marker in the gutter, with the message on hover. The list below the text stays.

## Non-Goals

- A code editor dependency (Monaco or CodeMirror). The panel stays a textarea, with a gutter and a suggestion list drawn by the app.
- Syntax colouring.
- Docking on the right. That side belongs to the element panel.

## Capabilities

### New Capabilities

- `guided-text-workspace`: covers the docked text panel, the line–step link in both directions, autocomplete, and in-place error markers.

### Modified Capabilities

None.

## Impact

- **Canvas layout:** `src/features/canvas/Canvas.tsx` gets a left dock slot, and `useCanvasPreferencesStore` gets a `textDock` preference.
- **Text panel:** `src/features/canvas/chrome/KindTextPanel.tsx` is split into a shared body, used by both the popover and the dock, plus the gutter, the suggestions and the cursor tracking.
- **Contract:** `KindTextCapture` gains `suggest?(ctx, base, text, cursor) → { from, items[] }`, a pure function.
- **Guided kind:** a guided implementation that reuses the outline tokenizer.
- **Selection:** the link uses `lineIds` from the base, plus the alignment for edited lines.
- **Other:** en and pt-BR keys and the docs.
