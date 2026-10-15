# Spec Delta

## Purpose

Defines the lifecycle of a live collaboration session on one diagram: how a host opens it, how
people join and leave, what a host drop or a lost room does, and how the session ends without
losing the host's work.

## ADDED Requirements

### Requirement: A host opens a session by seeding the room from its local diagram

When the host starts a session, the client SHALL create a room whose initial state is the host's
current diagram. The room SHALL accept edits only after the whole seed has been stored. The host
SHALL receive a shareable join link and a secret host credential.

#### Scenario: Session opens with the host's diagram

- **GIVEN** a host with a diagram of 40 nodes and 30 connections
- **WHEN** the host starts a live session
- **THEN** the room holds exactly those 40 nodes and 30 connections
- **AND** the host receives a join link and a host credential

#### Scenario: Seed interrupted before completion

- **GIVEN** a host whose seed transfer is cut half-way
- **WHEN** a guest tries to join that room
- **THEN** the guest is told the session is not ready yet and the room serves no partial state

### Requirement: Only the host credential grants host powers

Reconnecting as host, reseeding a room and closing a session SHALL require the host credential
issued at creation. The credential SHALL never be sent to guests or appear in any frame other
peers receive. A request without a valid credential SHALL be refused, and the room SHALL be left
unchanged.

#### Scenario: Guest impersonates the host

- **GIVEN** a guest who knows the host's user id
- **WHEN** the guest sends a reseed or a close for the room without the host credential
- **THEN** the server refuses it with an authorization error
- **AND** the room state and participants are unchanged

#### Scenario: Credential survives a reload of the host tab

- **GIVEN** a host in an open session
- **WHEN** the host reloads its tab
- **THEN** the client reconnects as host to the same room using the stored credential

### Requirement: Anyone with the link joins as an editor up to the room capacity

A join link SHALL be an unguessable room identifier. Every participant SHALL be able to edit.
A room SHALL admit at most 50 participants, host included, and the server SHALL configure that
limit. A join beyond capacity SHALL be refused with a message that names the limit.

#### Scenario: Joining an open room

- **WHEN** a guest opens a valid join link while the room has 10 participants
- **THEN** the guest receives the current diagram and can edit it

#### Scenario: Room is full

- **GIVEN** a room with 50 participants
- **WHEN** a 51st person opens the link
- **THEN** they are refused with a "room full (50)" message and are not counted as a participant

### Requirement: A host drop does not interrupt the room

When the host's connection drops without an intentional close, the room SHALL keep accepting and
distributing edits from guests. Guests SHALL see that the host is reconnecting. If the host has
not reconnected within 30 seconds, the session SHALL close for everyone as an intentional close
would.

#### Scenario: Host reconnects within the grace period

- **GIVEN** a session with a host and 5 guests
- **WHEN** the host's connection drops and comes back 4 seconds later
- **THEN** guests kept editing during those 4 seconds
- **AND** the host's diagram includes every edit guests made meanwhile

#### Scenario: Host never returns

- **WHEN** the host's connection drops and 30 seconds pass without a reconnect
- **THEN** every guest is told the session ended and is offered to import their local copy

### Requirement: An intentional host close ends the session for everyone

Ending the session from the UI, or closing or leaving the host tab, SHALL close the session for
all participants. Before the room is discarded, the host's local diagram SHALL hold the room's
final state, persisted through the normal storage port. Guests SHALL be offered to import their
local copy as a new diagram.

#### Scenario: Host ends the session

- **GIVEN** a session where guests added 3 components
- **WHEN** the host clicks "End session"
- **THEN** the host's saved diagram contains the 3 components
- **AND** every guest sees the session-ended dialog with an import option

#### Scenario: Host closes the tab

- **WHEN** the host closes the browser tab
- **THEN** guests are told the session ended within the grace period at the latest

### Requirement: A confirmed room loss is recovered by host reseed

If the server answers a host reconnect with an explicit "room unknown", the host client SHALL
recreate the room from its local copy and guests SHALL rejoin it. The host SHALL NOT reseed for
any other reason, such as a timeout, a version mismatch or a checksum mismatch.

#### Scenario: Relay storage restarted

- **GIVEN** an open session whose room state was lost by the relay storage
- **WHEN** the host reconnects and the server reports the room as unknown
- **THEN** the host reseeds with its current diagram
- **AND** guests rejoin and receive that state

#### Scenario: No reseed on a slow server

- **WHEN** the host's reconnect times out without a "room unknown" answer
- **THEN** the host retries the reconnect and does not reseed

### Requirement: Guests can always leave with their work

Whenever a guest's session ends — host close, grace expiry, or the room lost while the host is
also gone — the guest SHALL be offered to import their local copy of the diagram as a new diagram
in their own workspace.

#### Scenario: Room lost with the host gone

- **GIVEN** the room was lost and the host is not connected
- **WHEN** the guest's reconnect is answered with "room unknown"
- **THEN** the guest sees the session-ended dialog with the import option

### Requirement: Session UI text is localised

Every new message the session lifecycle shows (not ready, room full, host reconnecting, session
ended, too large, authorization refused) SHALL go through i18n with entries in `en` and `pt-BR`.

#### Scenario: Portuguese locale

- **GIVEN** the app language is pt-BR
- **WHEN** the room-full message is shown
- **THEN** it is rendered from the pt-BR locale
