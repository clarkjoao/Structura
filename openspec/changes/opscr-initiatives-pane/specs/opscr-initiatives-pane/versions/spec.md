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
