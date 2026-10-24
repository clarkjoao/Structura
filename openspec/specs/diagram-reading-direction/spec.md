# diagram-reading-direction Specification

## Purpose

Lets a diagram declare that it reads left-to-right or top-to-bottom, and keeps handles, edges
and layouts consistent with that declared axis rather than with where nodes happen to sit.

## Requirements

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

### Requirement: The draw.io export attaches edges on the declared axis

The draw.io export SHALL attach each edge where the canvas draws it for the diagram's reading
direction. In a top-to-bottom diagram, edges leave the bottom and enter the top, cross-axis
edges leave the right and enter the left, and slot offsets are spread along the side. A
left-to-right diagram's export SHALL be unchanged.

#### Scenario: Vertical export

- **GIVEN** a top-to-bottom diagram with an edge from A to B
- **WHEN** it is exported to draw.io
- **THEN** the edge's exit point is on A's bottom and its entry point on B's top

#### Scenario: Horizontal export is unchanged

- **GIVEN** any left-to-right diagram
- **WHEN** it is exported to draw.io
- **THEN** the output is identical to the output before this change

### Requirement: An imported direction is sanitised

A diagram imported from JSON, a connected folder or a share link SHALL keep a valid
`direction` and `layoutSettings`, and SHALL drop invalid values rather than store them.

#### Scenario: A bogus direction in a file

- **GIVEN** a JSON diagram whose `direction` is `"diagonal"`
- **WHEN** it is imported
- **THEN** the diagram reads left-to-right and stores no direction

### Requirement: A Mermaid flowchart's direction is honoured

Importing a Mermaid flowchart SHALL read its header direction. `TD` and `TB` SHALL mean
top-to-bottom and `LR` left-to-right; `BT` and `RL` SHALL take the nearest supported direction
and show a notice. Into an empty diagram, the import SHALL set the diagram's direction in the
same undo step as its layout. Into a diagram with content, the import SHALL be laid out on that
diagram's direction, with a notice when the header asked for the other one.

#### Scenario: TD into an empty diagram

- **GIVEN** an empty diagram
- **WHEN** the user imports a `flowchart TD`
- **THEN** the diagram becomes top-to-bottom and the imported elements are laid out downward

#### Scenario: TD into a horizontal diagram with content

- **GIVEN** a left-to-right diagram with elements
- **WHEN** the user imports a `flowchart TD`
- **THEN** the diagram stays left-to-right, the import is laid out left-to-right, and a notice says so

### Requirement: The assistant can ask for a direction

The assistant's diagram IR SHALL accept an optional `direction` of `LR` or `TB`, and SHALL
ignore any other value. A generation into an empty diagram SHALL set the diagram's direction to
the one asked for. A generation into a diagram with content SHALL be laid out on that diagram's
direction.

#### Scenario: Vertical generation

- **GIVEN** an empty diagram
- **WHEN** the assistant generates a diagram whose IR has `direction: "TB"`
- **THEN** the diagram becomes top-to-bottom and the generated elements are laid out downward

#### Scenario: Adding to a vertical diagram

- **GIVEN** a top-to-bottom diagram with elements
- **WHEN** the assistant adds elements with an IR that names no direction
- **THEN** the new elements are laid out top-to-bottom and the diagram stays top-to-bottom
