# Spec Delta

## Purpose

Defines how diagram state moves between participants of a live session and converges: the
patch format, server ordering, merge rules, resume, large-diagram transfer, and how a client
applies remote state without damaging local data.

## ADDED Requirements

### Requirement: The server is the single ordering authority during a session

Every accepted edit SHALL receive a room version from the server. Versions SHALL be gapless and
strictly increasing. Every participant SHALL receive accepted edits in version order, its own
included. Two participants that applied the same versions SHALL hold identical diagram state.

#### Scenario: Concurrent drags converge

- **GIVEN** two participants that move the same node at the same moment
- **WHEN** both edits are accepted
- **THEN** both participants end with the position of the higher-versioned edit

#### Scenario: Convergence under load

- **GIVEN** a room of 50 participants in which 20 drag nodes for 30 seconds
- **WHEN** all edits have been delivered
- **THEN** every participant's diagram equals the server's room state byte for byte

### Requirement: Clients send only the fields that changed

An edit SHALL carry only the entities and fields that changed. The server SHALL merge it field
by field. Concurrent edits to different fields of the same entity SHALL both survive. The server
SHALL distribute the portion of the edit that took effect, not the edit as sent.

#### Scenario: Different fields of the same component

- **GIVEN** participant A renames component C while participant B edits C's description
- **WHEN** both edits are applied
- **THEN** C has A's name and B's description for every participant

### Requirement: Removal wins over a concurrent edit

If a participant removes an entity, an edit to that entity from a participant that had not yet
seen the removal SHALL be dropped. An entity deliberately re-created after the removal SHALL be
accepted.

#### Scenario: Drag of a deleted node

- **GIVEN** A deletes node N at version 10
- **WHEN** B's drag of N, composed at version 9, arrives
- **THEN** N stays deleted for every participant and no orphan layout remains

### Requirement: Remote edits never rewrite unrelated local state

Applying a remote edit or a snapshot SHALL change only the diagram fields that collaboration
synchronises. Fields such as the folder, viewport and creation date SHALL be preserved. Remote
edits SHALL NOT enter the local user's undo history.

#### Scenario: Snapshot keeps the folder

- **GIVEN** a host whose diagram lives in folder F
- **WHEN** the host receives a full room snapshot
- **THEN** the diagram is still in folder F with its viewport unchanged

#### Scenario: Undo only undoes your own work

- **GIVEN** a guest moved node X, then the host moved node Y
- **WHEN** the guest presses undo
- **THEN** X returns to its previous position and Y does not move

### Requirement: A reconnecting client resumes from its last version

A client that reconnects SHALL declare the last version it fully applied. If the server can
replay every later edit, it SHALL send only those edits, possibly none. Otherwise it SHALL send
the full state. In every case the client SHALL end ready to edit.

#### Scenario: Reconnect with nothing missed

- **GIVEN** a guest at version 42 that drops while the room stays at version 42
- **WHEN** the guest reconnects
- **THEN** it receives an empty catch-up, becomes ready, and shows the canvas

#### Scenario: Reconnect after missed edits

- **GIVEN** a guest at version 42 that drops while the room advances to 57
- **WHEN** the guest reconnects
- **THEN** it receives versions 43–57 in order and matches the room

### Requirement: A client never claims a resume it cannot vouch for

A client SHALL declare a resume version only if its local state equals that version. Any local
edit that was not confirmed before the drop SHALL be discarded, and the client SHALL request the
full state.

#### Scenario: Unconfirmed edit at drop time

- **GIVEN** a guest whose last drag was sent but not confirmed when the socket dropped
- **WHEN** the guest reconnects
- **THEN** it receives the full room state and the unconfirmed drag is not applied

### Requirement: Diagrams up to the size limit transfer in chunks

Seeding a room and delivering a snapshot to a joiner SHALL work for diagrams of up to about
1,000 nodes, icons and version history included, by sending the state in bounded chunks. A
diagram over the configured limit SHALL be refused with a message stating its size and the limit.

#### Scenario: Large diagram session

- **GIVEN** a diagram of 1,000 nodes
- **WHEN** a host starts a session and a guest joins
- **THEN** the guest sees the full diagram within 3 seconds on a local network

#### Scenario: Diagram over the limit

- **WHEN** a host starts a session with a diagram larger than the configured limit
- **THEN** the host sees "diagram too large for a live session (X MB / limit Y MB)"
- **AND** no room is created

### Requirement: Synchronisation keeps working in a background tab

A participant's client SHALL apply inbound edits and send its own edits even when its tab is in
the background, with no dependence on animation frames.

#### Scenario: Host switches to another tab

- **GIVEN** a host whose tab is hidden behind a video call
- **WHEN** guests edit for 60 seconds
- **THEN** the host's diagram, once visible again, holds every guest edit without a resync

### Requirement: Drags are rate-limited at the source

While a node is dragged, a client SHALL send at most about 10 position updates per second, and
SHALL always send the final position when the drag ends.

#### Scenario: Fast drag

- **WHEN** a participant drags a node continuously for 2 seconds
- **THEN** no more than about 20 position edits are sent
- **AND** every peer ends with the exact drop position

### Requirement: Sessions reject incompatible clients

The join handshake SHALL carry the protocol version. The server SHALL refuse a client that does
not speak protocol v3, and the client SHALL show that the app needs to be updated.

#### Scenario: Old client

- **WHEN** a v2 client tries to join a v3 room
- **THEN** the join is refused and no state is exchanged
