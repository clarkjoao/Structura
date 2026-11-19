# Spec Delta

## Purpose

Each initiative of a bound product workspace is a Version of every diagram bound to the folder.

## ADDED Requirements

### Requirement: One Version per initiative

For a folder with `opscr.workspace.yaml`, the pane SHALL keep, in the bound diagram and in each View
diagram, one Version per `initiatives/<name>/`, with key `<name>`, the Initiative's `displayName` (or
`<name>`) as name and its status, owned by the plugin. It SHALL remove the plugin's Versions whose
initiative is gone.

#### Scenario: Initiative appears

- **GIVEN** a bound product folder with `initiatives/order-events/`
- **WHEN** the folder is loaded
- **THEN** the bound diagram has a Version keyed `order-events`, and selecting it shows the root with the initiative applied

#### Scenario: Initiative removed

- **WHEN** the initiative folder disappears
- **THEN** its Version is removed from every bound diagram

### Requirement: Root unaffected

The root engine SHALL ignore files under `initiatives/` and SHALL read and write the diagram's base
even while a Version is shown.

#### Scenario: Root edit while a Version is shown

- **GIVEN** an initiative's Version shown on the canvas
- **WHEN** a root manifest changes in the editor
- **THEN** the base changes and the Version shows the change where the initiative does not replace it

### Requirement: Version follows the root's canvas ids

When the root draws an element again under a new canvas id (the bound diagram showed a View and came
back, the folder was bound again), the pane SHALL draw that diagram's initiative Version again from
the YAML instead of reading the ids it lost as deletions. It SHALL keep the Version on screen if it
was shown, and SHALL NOT change the initiative's manifests or lock.

#### Scenario: View round trip on the bound diagram

- **GIVEN** an initiative's Version drawn on the bound diagram
- **WHEN** the pane shows a View on the bound diagram and then the whole workspace again
- **THEN** the Version shows the root with the initiative applied once (no stale copies) and the initiative's files are unchanged

### Requirement: View diagram Versions keep drill-down links

The Version of a View diagram SHALL link each box that opens another View to that View's diagram,
as the base does, and new elements of the initiative SHALL follow the View's drill-downs. The View
diagrams SHALL get their Versions as soon as they are made.

#### Scenario: Drill down inside an initiative

- **GIVEN** View diagrams switched on and the context diagram showing an initiative's Version
- **WHEN** the reader drills into the product box
- **THEN** the container diagram opens on the same Version, with the initiative's elements and edges
