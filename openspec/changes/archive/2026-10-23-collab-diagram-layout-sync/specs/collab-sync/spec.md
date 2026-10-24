# Spec Delta

## ADDED Requirements

### Requirement: The reading direction and arrange settings are synchronised

A live session SHALL synchronise a diagram's reading direction and arrange settings like its
other top-level fields. A change to either by one participant SHALL reach every participant, and
SHALL be applied only after sanitising: an unknown direction is left-to-right, and invalid
settings are dropped.

#### Scenario: A peer switches to vertical

- **GIVEN** two participants in a session on a relay that declares the fields
- **WHEN** one switches the diagram to top-to-bottom
- **THEN** the other's diagram reads top-to-bottom, with the same positions and routes

#### Scenario: Undo keeps a peer's direction

- **GIVEN** a peer switched the diagram to top-to-bottom after the local user's last edit
- **WHEN** the local user undoes that edit
- **THEN** the diagram stays top-to-bottom

### Requirement: A client sends only the doc fields its relay declares

The relay SHALL declare in `joined` the doc fields it accepts. A client SHALL NOT send a doc field
the relay has not declared, and SHALL treat a `joined` without the declaration as the original
seven fields. A host SHALL seed with the original fields only, and SHALL send the declared new
ones after `joined`.

#### Scenario: An older relay

- **GIVEN** a relay whose `joined` has no `docFields`
- **WHEN** the host opens a session on a top-to-bottom diagram
- **THEN** the seed and every patch carry no `direction` or `layoutSettings`, no patch is refused, and the direction switch is disabled with an explanation

#### Scenario: A current relay

- **GIVEN** a relay whose `joined` declares `direction` and `layoutSettings`
- **WHEN** the host opens a session on a top-to-bottom diagram
- **THEN** the host sends the direction after `joined`, a guest that joins receives it, and the direction switch is enabled
