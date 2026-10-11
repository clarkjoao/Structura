# Spec Delta

## ADDED Requirements

### Requirement: Canvas selection and highlight

The API SHALL expose `api.canvas` (capability `diagram:read`): the selected components and
connection of the active diagram, a subscription to their changes, and `highlight()`, which lights
the given components and connections (others dim) and brings them into view only when they are
not, leaving the selection as it is.

#### Scenario: Highlighting an element off screen

- **WHEN** a plugin highlights a component that is outside the visible canvas
- **THEN** the component is lit and the canvas pans to it; a component already on screen is lit
  without moving the canvas

### Requirement: Editor files, lines and comparison

`CodeEditor` SHALL keep a separate model per `path` (undo history, cursor and scroll), move the
cursor to `revealLine` when its token changes, report the user's cursor moves through
`onCursorLine` (not those made by `revealLine`), and show a comparison of `original` against the
editable `value` when `original` is given.

#### Scenario: Undo after switching files

- **GIVEN** an edit in file A, then a switch to file B
- **WHEN** the user presses undo in B
- **THEN** only B's own edits are undone; A keeps its text
