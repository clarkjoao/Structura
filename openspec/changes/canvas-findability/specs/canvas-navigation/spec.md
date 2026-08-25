# Spec: canvas-navigation

## ADDED Requirements

### Requirement: Canvas offers a spatial overview

The editor canvas MUST render a minimap giving a scaled overview of the whole diagram and of the
current viewport within it. The minimap MUST be pannable and zoomable, so clicking or dragging
in it moves the viewport. Node color MUST be derived from the component's type descriptor, with
a neutral fallback for plugin and unknown types, and the minimap chrome MUST use the same theme
tokens as the existing `<Controls>` so it reads correctly in light and dark.

#### Scenario: Minimap reflects the diagram

- **GIVEN** a diagram with nodes spread across the canvas
- **WHEN** the canvas is open
- **THEN** the minimap shows a scaled representation of every visible node
- **AND** it highlights the region covered by the current viewport

#### Scenario: Clicking the minimap navigates

- **WHEN** the user clicks a point in the minimap
- **THEN** the viewport moves to that region of the diagram

#### Scenario: Unknown node type still renders

- **GIVEN** a diagram containing a component whose type belongs to an absent plugin
- **WHEN** the minimap renders
- **THEN** that node is drawn with the neutral fallback color and no error is raised

### Requirement: Minimap visibility is a persisted preference

The minimap MUST be toggleable, default on, and the choice MUST persist across reloads. The
control MUST live alongside the other canvas view preferences, and its label MUST come from
`t()` with entries in both `en.json` and `pt-BR.json`.

#### Scenario: Turning the minimap off

- **WHEN** the user turns the minimap off
- **THEN** it stops rendering and the canvas area it occupied is free
- **AND** after a reload it is still off

### Requirement: Canvas recovers an empty viewport

When the diagram contains at least one node and none of them intersect the current viewport, the
canvas MUST show a floating recovery card naming how many elements exist and offering an action
that fits all of them into view. The card MUST disappear as soon as any node is visible again,
and MUST NOT appear for an empty diagram. Its strings MUST come from `t()` with entries in both
`en.json` and `pt-BR.json`.

#### Scenario: User pans away from all content

- **GIVEN** a diagram with nodes
- **WHEN** the user pans until no node intersects the viewport
- **THEN** the recovery card appears with the element count

#### Scenario: Recovery action brings the content back

- **GIVEN** the recovery card is showing
- **WHEN** the user activates its fit action
- **THEN** the viewport is fitted to all nodes using the canvas fit-view constants
- **AND** the card disappears

#### Scenario: Empty diagram shows nothing

- **GIVEN** a diagram with no components
- **WHEN** the canvas is open
- **THEN** the recovery card is not rendered

#### Scenario: Partially visible node counts as visible

- **GIVEN** a node whose bounding box only partly overlaps the viewport
- **WHEN** occupancy is evaluated
- **THEN** the node counts as visible and the card is not shown
