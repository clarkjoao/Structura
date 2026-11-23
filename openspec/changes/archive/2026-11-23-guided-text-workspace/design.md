# Design

## Context

What exists today:

- **The panel.** `KindTextPanel` is a Radix popover holding the journey and insert modes, plus `rebase` and `reconcile`.
- **Line ids.** `writeGuidedOutline` returns `lineIds`, and `alignLines` maps the edited lines.
- **Preferences.** Canvas preferences live in `useCanvasPreferencesStore`, which is per browser.

## Decisions

### 1. One body, two frames

The state and logic move into `KindTextBody`: base, draft, review, suggestions and cursor. `KindTextPanel` keeps the popover frame, and `KindTextDock` renders the same body in a left column with a resize handle. Only one frame is mounted at a time, chosen by `textDock`.

### 2. The gutter and highlight without an editor

A line-number gutter is drawn beside the textarea, in the same font, with its scroll synced. Error markers and the selected-line highlight sit in that gutter, plus a tinted band behind the line in a mirrored layer.

_Alternative considered:_ CodeMirror. It is more robust, but it is a new dependency and the panel has very modest needs.

### 3. Cursor to step

On `selectionchange`, the line index of the caret is looked up through the line → id map: `lineIds` for an untouched text, `alignLines` for a draft. The step is selected through the canvas selection store and framed with `frameNodes` if it is off-screen. This is debounced by 150 ms so typing does not jump the canvas.

### 4. Suggestions as a pure function

`suggest(ctx, base, text, cursor)` reads the current line up to the caret:

- a line start with no `:` yet suggests lanes;
- `@` followed by text suggests steps;
- `## ` suggests phases.

It returns `{ from, items }`. The list is drawn under the caret, positioned with a mirrored measurement div.

## Risks / Trade-offs

- **[Risk]** Positioning the caret in a textarea is fiddly. → **Mitigation:** use the standard mirror-div technique and test it at two font sizes.
- **[Risk]** Selecting on the canvas while the author is typing steals focus. → **Mitigation:** cursor-to-canvas selection never moves focus, and canvas-to-text only scrolls and highlights.

## As implemented

- **Where the dock sits.** It is a persistent panel anchored under the mode bar on the canvas's left. The design described a layout column, but that would have meant reshaping the canvas layout for one panel. It stays open across canvas clicks, is resizable from 280 to 640 px, and the choice and width are kept in `useCanvasPreferencesStore`.
- **One body, two frames.** It is done inside `KindTextPanel`, not as a separate component: the same body renders in the popover or in the dock. The journey field is `KindJourneyEditor` (gutter, error markers, highlighted line, completions).
- **Suggestions.** They open just under the field, not at the caret. Positioning at the caret would need the mirrored-measurement technique, and it adds little in a narrow panel.
- **Line alignment.** `alignLines` moved to `diagram-kinds/textAlign.ts`, so the host can map the lines of an edited draft to steps without reaching into the guided kind.
