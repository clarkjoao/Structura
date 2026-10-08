# Spec Delta

## ADDED Requirements

### Requirement: The preview draws only validated YAML

The VSCode preview SHALL draw the folder's workspace only when opscr validates it without errors,
whether the change was typed, saved or written to disk by another tool. While the YAML does not
parse or has errors, the preview SHALL keep its last valid picture and say why in the status bar;
warnings SHALL NOT block. Elements already drawn keep their place and new ones are laid out
automatically.

#### Scenario: Claude Code writes a file

- **GIVEN** an open preview of the opscr sample
- **WHEN** another tool writes a valid `search.opscr.yaml` to the folder
- **THEN** the preview draws `search-api` without the file being opened

#### Scenario: An edit with an opscr error

- **WHEN** the user adds a manifest with an unknown field
- **THEN** the preview keeps its picture, the error is in the Problems panel and the status bar says
  the preview is not updated
- **AND** a banner in the preview says the picture is not up to date

#### Scenario: The workspace has errors when the preview opens

- **GIVEN** a folder whose YAML has opscr errors
- **WHEN** the user opens the preview
- **THEN** instead of waiting for a diagram, the preview says how many errors there are, lists the
  first ones and points to the Problems panel

### Requirement: Find elements in the preview

The preview SHALL let the reader find a diagram element by name with Ctrl/Cmd+F, whether the focus
is inside the preview or on its tab, and SHALL bring the chosen element into view.

#### Scenario: Searching a large diagram

- **GIVEN** an open preview of the opscr sample
- **WHEN** the user presses Cmd+F and picks `orders-db` from the results
- **THEN** the search closes and the canvas zooms to `orders-db`

### Requirement: The preview shows what changed

When an update adds elements, changes them or connects them, the preview SHALL bring them into view
once they are drawn. The first picture and updates that change nothing visible SHALL NOT move the
reader's viewport.

#### Scenario: A component is added

- **GIVEN** an open preview the reader has panned away from
- **WHEN** a valid manifest adds `search-api` connected to `public-api`
- **THEN** the canvas zooms to `search-api` and `public-api`
