# guided-flow-layout Specification

## Purpose

The arrangement that turns a guided diagram's lanes and step graph into positions. Lanes are bands
across the reading axis, and steps take columns along it in sequence order. It is the only thing
that places a step.

## Requirements

### Requirement: Lanes are bands, sequence is the reading axis

In a left-to-right guided diagram, lanes SHALL be horizontal bands stacked top to bottom in lane
order, all the same width, and steps SHALL be placed left to right by their position in the
sequence. In a top-to-bottom diagram the same arrangement SHALL be mirrored: lanes become vertical
bands left to right and the sequence runs downwards. A step SHALL always be drawn inside its
lane's band.

#### Scenario: Left to right

- **WHEN** a guided diagram has lanes "Cliente", "App" and "API", and the sequence Abre app (Cliente) → Valida (App) → POST /pedido (API)
- **THEN** the three steps are in three consecutive columns, each inside its own lane's band, and the bands are stacked in that order

#### Scenario: Top to bottom

- **WHEN** the same diagram is switched to top-to-bottom
- **THEN** the lanes are side-by-side columns and the steps descend in sequence order

### Requirement: A step never shares a column slot with an earlier one

A step SHALL be placed in a later column than every step it is reached from, back-edges excepted.
Two steps in the same lane and column SHALL be stacked inside the band, which grows to hold them,
and SHALL NOT overlap.

#### Scenario: Two exits in one lane

- **WHEN** a decision in "App" has two exits that are both in "App"
- **THEN** the two exits share the next column, stacked inside the "App" band, without overlap

### Requirement: The arrangement runs after every structural edit

After any structural edit made by this editor to a guided diagram in guided mode, whether by the author, a plugin, the assistant or a paste, (a step or lane added, removed, moved to
another lane, or reordered, or a connection added or removed), the whole guided arrangement SHALL
be applied and recorded together with the edit as one undo step. It SHALL animate like any
arrangement and SHALL NOT change the viewport. It SHALL NOT run for a peer's change in a
collaboration session; the peer's positions SHALL be taken as received.

#### Scenario: Peer edit

- **WHEN** a collaborator adds a step to a shared guided diagram
- **THEN** the local editor shows the step at the position the collaborator's editor computed and runs no arrangement of its own

### Requirement: The arrangement is deterministic and stable

The same lanes, steps and connections SHALL always produce the same positions. An edit SHALL move
only the steps whose column or stack slot it changes; steps before the edited point in the
sequence, in lanes the edit did not touch, SHALL keep their positions.

#### Scenario: Appending leaves the rest alone

- **WHEN** the author appends a step after the last step
- **THEN** every step already in the diagram keeps its position

### Requirement: Edges keep the declared sides

Edges in a guided diagram SHALL leave the output side of their source and reach the input side of
their target on the diagram's reading axis, whatever the lanes involved. A back-edge SHALL be
routed as one and SHALL NOT flip a side to shorten its route (ADR-0013).

#### Scenario: Cross-lane edge

- **WHEN** a step in "Cliente" connects to a step in "API" two lanes below, left to right
- **THEN** the edge leaves the right side of the first step and enters the left side of the second

### Requirement: Density applies to guided layout

The diagram's layout density and gap overrides SHALL scale the spacing between columns, between
stacked steps and between lanes, exactly as they scale an ordinary arrangement.

#### Scenario: Spacious

- **WHEN** the author sets density to spacious
- **THEN** the guided diagram is re-arranged with wider columns and taller gaps, as one undo step
