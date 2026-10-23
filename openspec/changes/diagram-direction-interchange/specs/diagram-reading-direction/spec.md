# Spec Delta

## ADDED Requirements

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
