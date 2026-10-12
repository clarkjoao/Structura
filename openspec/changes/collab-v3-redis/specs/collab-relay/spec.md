# Spec Delta

## Purpose

Defines the collaboration relay as a deployable service: how it runs as a single instance or as
many stateless instances over shared storage, its abuse limits, and the measurable resilience and
load targets that an automated harness must prove.

## ADDED Requirements

### Requirement: The relay runs with or without shared storage

Without shared storage configured, the relay SHALL run as a single instance with in-memory
rooms. With shared storage configured, any number of relay instances SHALL serve the same rooms.
Participants of one room connected to different instances SHALL see each other's edits as if
connected to one.

#### Scenario: Single instance, no shared storage

- **GIVEN** the relay started without a storage URL
- **WHEN** a host and 3 guests hold a session
- **THEN** the session behaves as specified in collab-session and collab-sync

#### Scenario: Room spread across instances

- **GIVEN** three relay instances on shared storage and a round-robin balancer
- **WHEN** a host and 10 guests join, each landing on an arbitrary instance
- **THEN** every edit reaches every participant in the same version order

### Requirement: Losing an instance does not lose a session

When a relay instance dies, participants connected to it SHALL reconnect to another instance and
be able to edit again within 5 seconds. No edit the room had confirmed SHALL be lost.

#### Scenario: Instance killed mid-session

- **GIVEN** a room of 30 participants spread over three instances, with edits in flight
- **WHEN** one instance is killed
- **THEN** its participants are editing again within 5 seconds
- **AND** every confirmed edit is still present for every participant

### Requirement: Shared storage restart is recoverable

If the shared storage loses room state, the relay SHALL report the room as unknown on the next
reconnect, which triggers host reseed per collab-session. The relay SHALL never serve an empty or
partial room as if it were the room's state.

#### Scenario: Storage restarted without persistence

- **GIVEN** an open session and storage restarted with no persisted data
- **WHEN** participants reconnect
- **THEN** the host reseeds and the room is back with the host's state
- **AND** no participant ever received an empty diagram as the room's state

### Requirement: The relay enforces abuse limits

The relay SHALL limit each participant's edit rate (high enough for continuous dragging at
10 Hz), the size of a single message, and room capacity. It SHALL reject keys that could pollute
object prototypes. Breaches SHALL be answered with a specific error code and SHALL NOT affect
other participants or rooms.

#### Scenario: Flooding participant

- **WHEN** one participant sends edits far above the rate limit
- **THEN** that participant receives rate-limit errors
- **AND** other participants' edit latency stays within target

### Requirement: Load and resilience targets are proven by an automated harness

A repeatable harness SHALL run several relay instances, shared storage and a balancer, and SHALL
assert these targets:

- 500 connections across 35 rooms, including 3 rooms of 50 with 20 people dragging at 10 Hz;
- p95 latency below 150 ms from a patch being sent to peers receiving it;
- zero divergent clients;
- recovery within 5 s after an instance kill;
- recovery by reseed after a storage restart.

#### Scenario: CI acceptance run

- **WHEN** the acceptance harness runs in CI
- **THEN** it fails the build if any target above is missed, and reports the measured values

### Requirement: The relay ships with Kubernetes manifests

The relay's deployment project SHALL provide manifests that deploy several relay replicas with
autoscaling, shared storage, health checks, and a WebSocket-capable ingress. The resilience
scenarios SHALL pass against a local Kubernetes cluster built from them.

#### Scenario: Local cluster run

- **GIVEN** a local cluster created from the deployment project's manifests
- **WHEN** the instance-kill scenario runs against it
- **THEN** participants are editing again within 5 seconds
