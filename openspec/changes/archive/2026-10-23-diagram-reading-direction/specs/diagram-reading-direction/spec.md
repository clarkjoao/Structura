# Spec Delta

## Purpose

Lets a diagram declare that it reads left-to-right or top-to-bottom, and keeps handles, edges
and layouts consistent with that declared axis rather than with where nodes happen to sit.

## ADDED Requirements

### Requirement: A diagram declares its reading direction

A diagram SHALL carry an optional reading direction. It is absent (left-to-right) or `TB`
(top-to-bottom), and absent SHALL behave exactly as before this change. The direction SHALL be
saved, undone and reloaded with the diagram through the persistence port.

#### Scenario: Existing diagrams are unchanged

- **GIVEN** a diagram saved before this change
- **WHEN** it is opened and arranged
- **THEN** its handles, edges and arrangement are identical to before

#### Scenario: The direction survives a reload

- **GIVEN** a diagram switched to top-to-bottom
- **WHEN** the workspace is reloaded
- **THEN** the diagram still reads top-to-bottom

### Requirement: Sides follow the declared axis, never the geometry

In a top-to-bottom diagram, every node SHALL receive edges on its top side and send them from its
bottom side. A node with cross-axis handles SHALL also offer left (in) and right (out). The side
an edge uses SHALL come from the diagram's direction and the edge's own stored side, and SHALL
NOT change when nodes move.

#### Scenario: Moving a node never rewires an edge

- **GIVEN** a top-to-bottom diagram with an edge from A to B
- **WHEN** the user drags B above A
- **THEN** the edge still leaves A's bottom and enters B's top

#### Scenario: A cross-axis edge in a vertical diagram

- **GIVEN** a top-to-bottom diagram with a flowchart decision
- **WHEN** the user draws an edge from the decision's right handle
- **THEN** the edge is stored as leaving from the right, and keeps that side

#### Scenario: A left-to-right cross-axis edge after switching

- **GIVEN** a left-to-right diagram with an edge stored as leaving a decision from the bottom
- **WHEN** the diagram is switched to top-to-bottom
- **THEN** the edge leaves from the bottom, which is now the main output

### Requirement: Layouts run along the declared axis

In a top-to-bottom diagram, the full arrangement SHALL place layers from top to bottom with
edges flowing downward, and so SHALL the arrangement of a selection or of a panel's children
and the automatic placement. Containers SHALL hold their children with room for their header.
A left-to-right diagram SHALL lay out exactly as before.

#### Scenario: Arranging a vertical diagram

- **GIVEN** a top-to-bottom diagram with a chain A → B → C
- **WHEN** the user arranges it
- **THEN** B is below A and C is below B, and no child is outside its panel

#### Scenario: Automatic placement in a vertical diagram

- **GIVEN** a top-to-bottom diagram in automatic mode
- **WHEN** the user connects a new element from an existing one
- **THEN** the new element is placed one row below it, and nothing else moves

### Requirement: Switching the direction is one whole-diagram step

Switching the reading direction from the Arrange menu SHALL set the direction, re-arrange the
whole diagram on the new axis, re-derive every edge route, and record all of it as a single undo
step. Undo SHALL restore the previous direction, positions and routes. The switch SHALL be
unavailable on a canvas that cannot be edited and during a live session. Every visible string
SHALL come from i18n in `en` and `pt-BR`.

#### Scenario: Switch and undo

- **GIVEN** a left-to-right diagram with hand-tuned edge routes
- **WHEN** the user switches it to top-to-bottom and then presses undo once
- **THEN** the diagram is left-to-right again with its previous positions and routes

#### Scenario: Not during a live session

- **GIVEN** a diagram open in a live session
- **WHEN** the user opens the Arrange menu
- **THEN** the direction switch is disabled, with a hint that explains why

### Requirement: The viewer draws the declared direction

The read-only viewer SHALL draw handles and edges on the sides the diagram's direction declares.

#### Scenario: Shared vertical diagram

- **GIVEN** a top-to-bottom diagram shared as a link
- **WHEN** it is opened in the viewer
- **THEN** edges leave from the bottom and arrive on top, as in the editor
