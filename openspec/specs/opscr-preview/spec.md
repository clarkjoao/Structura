# opscr-preview Specification

## Purpose

A live, read-only preview of an opscr workspace inside VSCode, rendered by Structura, that follows
the text as it is edited without rearranging what the reader has already seen.

## Requirements

### Requirement: The preview shows the workspace of the active file

Opening the preview on a `*.opscr.yaml` file SHALL render the technical view of every opscr manifest
file in that file's folder, using the unsaved text of any of them open in an editor.

#### Scenario: Multi-file workspace

- **GIVEN** a folder with the opscr sample's five files and `relationships.opscr.yaml` active
- **WHEN** the user runs _opscr: Open Preview to the Side_
- **THEN** the preview shows the Domain and bounded-context panels and the edges between elements
  declared in the other files

### Requirement: The preview follows edits

The preview SHALL update after the user stops typing for a short interval, without saving. While the
workspace's YAML does not parse, the preview SHALL keep the last picture it drew.

#### Scenario: New manifest appears

- **GIVEN** an open preview
- **WHEN** the user adds a Cache manifest and a `reads` edge to it
- **THEN** the Cache and the edge appear in the preview without saving the file

#### Scenario: Half-typed YAML

- **GIVEN** an open preview
- **WHEN** the active file stops parsing mid-edit
- **THEN** the preview keeps showing the last diagram

### Requirement: Existing elements keep their place

On an update, every element whose Kind and name existed in the previous picture under the same
parent SHALL keep its position relative to that parent; an element whose parent changed SHALL be
placed like a new one. New elements SHALL be placed without overlapping existing siblings,
and panels SHALL grow to contain their children. _opscr: Re-layout Preview_ SHALL lay everything
out from scratch.

#### Scenario: Adding an element moves nothing

- **GIVEN** the preview of the opscr sample
- **WHEN** a Cache and an edge to it are added
- **THEN** every element of the sample has the same position as before and the Cache overlaps no
  sibling

#### Scenario: An element moves to another panel

- **WHEN** an element's `belongsTo` changes to another panel
- **THEN** it is placed inside that panel next to its new siblings, not at its old offset

#### Scenario: Description change

- **WHEN** only a description changes
- **THEN** no element moves

### Requirement: opscr diagnostics appear in the Problems panel

The extension SHALL report opscr errors and warnings for the workspace in VSCode's Problems panel,
on the file and line they refer to, and clear them when fixed.

#### Scenario: Unknown field

- **WHEN** a manifest gains a field its Kind does not declare
- **THEN** the Problems panel shows the opscr error on that line, and it disappears when the field is
  removed

### Requirement: The preview and the YAML point at each other

Clicking an element or a connection in the preview SHALL open, in an editor beside it, the file of
the manifest or edge that writes it with the cursor on its line. Moving the cursor into a manifest
or edge SHALL light the element it writes in the preview, bringing it into view when it is off
screen, and SHALL leave the preview as it is while the picture is held back by errors. While the
YAML has errors, each problem the preview lists SHALL open its line when clicked.

#### Scenario: Click to source

- **WHEN** the user clicks the `orders-db` Database in the preview
- **THEN** its manifest opens with the cursor on it

#### Scenario: Cursor to element

- **WHEN** the cursor moves into the `orders-api` manifest
- **THEN** `orders-api` is lit in the preview; a `belongsTo` edge lights the element it places

### Requirement: The preview is read-only and follows the theme

The preview SHALL NOT edit any file, and SHALL render dark when VSCode uses a dark or high-contrast
dark theme and light otherwise.

#### Scenario: Theme switch

- **WHEN** the user switches VSCode to a dark theme
- **THEN** the preview renders dark without reloading

### Requirement: Preview uses the layout sidecar

The VSCode preview SHALL seed its layout with the folder's `opscr.layout.json` when present, and
re-apply it when the file changes; elements it does not list are placed by the stable layout.

#### Scenario: Sidecar written by Structura

- **GIVEN** an open preview
- **WHEN** Structura saves a sidecar that moves `orders-db`
- **THEN** the preview redraws `orders-db` at the sidecar's position

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
