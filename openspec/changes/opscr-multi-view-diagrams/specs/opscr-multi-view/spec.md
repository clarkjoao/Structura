# Spec Delta

## Purpose

Draw each opscr View as its own Structura diagram, linked by drill-down, laid out by Structura.

## ADDED Requirements

### Requirement: One diagram per View
For a workspace with Views, the opscr plugin SHALL keep one diagram bound per View, with exactly the
elements and edges `resolveView` returns for it. A workspace with no View SHALL keep the single
diagram it draws today.

#### Scenario: First sync
- **GIVEN** a workspace with a `SystemContext` and a `Container` view
- **WHEN** the plugin syncs for the first time
- **THEN** two diagrams exist, each showing only its view's elements, laid out by Structura

#### Scenario: Removed view
- **WHEN** a View is deleted from the YAML
- **THEN** its diagram is kept, marked orphaned, and the pane lists it

### Requirement: Drill-down links
A `drillDown` entry SHALL set `linkedDiagramId` of the element's component to the diagram bound to
the target View.

#### Scenario: Open the container view from the context view
- **WHEN** the user opens the linked component of the system in the context diagram
- **THEN** the container diagram opens

### Requirement: Per-view layout
Positions SHALL be stored per View in `opscr.layout.json` version 2, and version 1 files SHALL still
load as the default view's layout.

#### Scenario: Same element, two diagrams
- **WHEN** the user moves `Application/web` in the container diagram
- **THEN** its position in the deployment diagram is unchanged

### Requirement: C4 and deployment shapes
`Person`, `Component` and `DeploymentNode` SHALL be drawn with C4 person and component shapes and
AWS group panels respectively; a `DeploymentNode` of type `region`, `availabilityZone`, `vpc`,
`publicSubnet` or `privateSubnet` uses the matching AWS group style.

#### Scenario: Subnet panel
- **WHEN** a `DeploymentNode` of type `privateSubnet` is drawn
- **THEN** it is a panel with the private-subnet group style and contains its deployed elements
