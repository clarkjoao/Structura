# Spec Delta

## Purpose

Defines what participants of a live session see of each other — cursors, who is editing what —
and the short-lived locks that keep two people from dragging or retyping the same element at
once.

## ADDED Requirements

### Requirement: Participants see each other's cursors

Each participant SHALL see the other participants' cursors with their name and colour, updated
at least 10 times per second while they move. A participant SHALL NOT see its own cursor echoed.
Cursor updates MAY be dropped under backpressure, because the next update supersedes them.

#### Scenario: Cursor leaves the canvas

- **WHEN** a participant's pointer leaves the canvas
- **THEN** the other participants stop showing that cursor

### Requirement: Dragging or retyping an element takes a soft lock

Starting to drag a node or to edit an element's text SHALL take a lock on that element for the
participant. The lock SHALL be renewed while the gesture continues and SHALL expire about 3
seconds after its last renewal, so a dropped participant never leaves an element locked.

#### Scenario: Second person tries to drag a held node

- **GIVEN** participant A is dragging node N
- **WHEN** participant B tries to drag N
- **THEN** B's drag does not start and B sees that A is moving N

#### Scenario: Holder disconnects mid-drag

- **GIVEN** A holds the lock on N and A's connection drops
- **WHEN** about 3 seconds pass
- **THEN** any participant can drag N

### Requirement: Everything else is last-writer-wins with an indication

Edits that take no lock, such as properties edited in the side panel, SHALL apply by the field
merge rules. Every participant SHALL see which other participants are currently editing an
element, on the element itself.

#### Scenario: Two people in the properties panel

- **GIVEN** A and B both have component C open in the side panel
- **WHEN** A edits C's technology and B edits C's owner
- **THEN** both edits survive
- **AND** each sees the other's name on C while they edit

### Requirement: Presence text is localised

Lock and editing indications SHALL be rendered through i18n with `en` and `pt-BR` entries.

#### Scenario: Lock message in English

- **GIVEN** the app language is en
- **WHEN** B is blocked by A's lock
- **THEN** B sees the English lock message naming A
