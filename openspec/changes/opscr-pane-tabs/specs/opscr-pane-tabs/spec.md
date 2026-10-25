# Spec Delta

## ADDED Requirements

### Requirement: The pane is organised in tabs

The opscr pane SHALL show, under its folder header, the tabs Overview, Initiatives (for a product
workspace only), Files and Problems. Files SHALL show the folder as a tree above the editor. Problems
SHALL list opscr's diagnostics by file, and choosing one SHALL open its file at its line in Files.
The pane SHALL keep its tab when it is closed and opened again, and SHALL open an empty folder on
Files.

#### Scenario: A problem opens its file

- **GIVEN** an opscr error in `webshop.opscr.yaml` at line 12
- **WHEN** the user chooses it in Problems
- **THEN** the Files tab opens `webshop.opscr.yaml` at line 12

#### Scenario: Initiatives in their folder

- **GIVEN** a product workspace with `initiatives/order-events/`
- **WHEN** the user opens Files
- **THEN** the initiative's files are listed under `initiatives/order-events`, which folds
