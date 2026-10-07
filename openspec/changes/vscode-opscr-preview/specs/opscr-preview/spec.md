# Spec Delta

## Purpose

A live, read-only preview of an opscr workspace inside VSCode, rendered by Structura, that follows
the text as it is edited without rearranging what the reader has already seen.

## ADDED Requirements

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

On an update, every element whose Kind and name existed in the previous picture SHALL keep its
position relative to its parent. New elements SHALL be placed without overlapping existing siblings,
and panels SHALL grow to contain their children. _opscr: Re-layout Preview_ SHALL lay everything
out from scratch.

#### Scenario: Adding an element moves nothing

- **GIVEN** the preview of the opscr sample
- **WHEN** a Cache and an edge to it are added
- **THEN** every element of the sample has the same position as before and the Cache overlaps no
  sibling

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

### Requirement: The preview is read-only and follows the theme

The preview SHALL NOT edit any file, and SHALL render dark when VSCode uses a dark or high-contrast
dark theme and light otherwise.

#### Scenario: Theme switch

- **WHEN** the user switches VSCode to a dark theme
- **THEN** the preview renders dark without reloading
