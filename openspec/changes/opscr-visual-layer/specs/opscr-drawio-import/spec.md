# Spec Delta

## Purpose

Lets the opscr pane migrate a draw.io architecture diagram into the bound folder without a
terminal: it runs opscr's deterministic import in the browser, writes the workspace and draws it.

## ADDED Requirements

### Requirement: Import a draw.io file from the pane

The opscr pane SHALL offer **Import .drawio…**, accepting `.drawio`, `.drawio.svg` and `.xml`
files. It SHALL run opscr's import with no agent step and write its files into the bound folder.

#### Scenario: Import into an empty folder

- **GIVEN** a diagram bound to an empty folder
- **WHEN** the user imports `arquitetura.drawio`
- **THEN** the folder holds the manifests, `opscr.layout.json`, `opscr.visual.json`, `analysis.json` and `IMPORT-SUMMARY.md`, and the canvas draws them

### Requirement: The import is a one-way migration

**Import .drawio…** SHALL be offered on a bound folder with no opscr workspace yet (no manifests,
sidecars, `analysis.json` or summary); on any other folder it SHALL refuse and ask for an empty
one. Existing files SHALL never be overwritten.

#### Scenario: Folder with manifests

- **GIVEN** a bound folder that already has `*.opscr.yaml` files
- **WHEN** the user tries to import `legacy.drawio`
- **THEN** nothing is written and the pane says the import is a one-time migration into an empty folder

### Requirement: Several pages

The plugin folder access writes top-level files only, so a drawing with several architecture pages
SHALL bring its first page and name the others, to be imported with the opscr CLI.

#### Scenario: Overview and detail

- **WHEN** the user imports a drawing with pages "Overview" and "Detail"
- **THEN** the folder holds the workspace of "Overview" and the pane names "Detail" for the CLI

### Requirement: The summary is a review list

After an import the pane SHALL list the manifests the import assumed (implicit nodes included),
with their evidence, and the pages flagged as not architecture; selecting an item SHALL open its
manifest line. Edges to review stay in `IMPORT-SUMMARY.md`.

#### Scenario: Review an assumed element

- **WHEN** the user selects `Database/bd-pedidos` in the review list
- **THEN** the editor opens its file at its manifest

### Requirement: Import failures are contained

A file the import cannot read SHALL leave the folder and the canvas unchanged and show the reason.

#### Scenario: Not a draw.io file

- **WHEN** the user imports a PNG renamed `.drawio`
- **THEN** nothing is written and the pane shows "no diagram found"
