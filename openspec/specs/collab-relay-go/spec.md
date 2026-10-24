# collab-relay-go Specification

## Purpose

The Go relay serves protocol v3 in two deployment shapes: a long-lived process and AWS Lambda
behind an API Gateway WebSocket API.

## Requirements

### Requirement: The Go relay is wire-compatible with the TypeScript relay

The Go relay SHALL accept every client that the TypeScript v3 relay accepts and SHALL produce
the same room state for the same sequence of patches.

#### Scenario: Shared merge fixtures

- **GIVEN** the merge fixtures exported from the TypeScript suite
- **WHEN** the Go memory, Redis and DynamoDB stores apply them
- **THEN** every final version and state equals the fixture's

#### Scenario: Seed split inside a surrogate pair

- **GIVEN** a diagram whose seed text has an emoji across a chunk boundary
- **WHEN** the host seeds the room
- **THEN** a joiner receives the emoji intact

### Requirement: Redis is optional

The long-lived relay SHALL run with rooms in memory when no Redis URL is configured, and with
rooms in Redis otherwise. The serverless relay SHALL run with rooms in DynamoDB when no Redis URL
is configured, and in Redis otherwise.

#### Scenario: Single instance without Redis

- **GIVEN** the long-lived relay started with no `REDIS_URL`
- **WHEN** a host and a guest edit a room
- **THEN** both converge on the same state

### Requirement: Serverless delivery is ordered and gap-free

In serverless mode every joined socket SHALL receive every entry after its snapshot or catch-up,
exactly once and in version order, however invocations interleave.

#### Scenario: Concurrent edits from many sockets

- **GIVEN** a room where several participants send patches concurrently through the API
  Gateway emulator, which runs invocations in parallel
- **WHEN** every participant compares its state with a fresh joiner's
- **THEN** all states are equal

#### Scenario: Join during a burst

- **GIVEN** a room receiving edits
- **WHEN** a participant joins
- **THEN** it receives its snapshot before any entry, and every entry after the snapshot's
  version

### Requirement: Serverless sessions end without a process

A room whose host left SHALL close after the host grace period even when nobody sends a message,
through the scheduled reaper.

#### Scenario: Host leaves a quiet room

- **GIVEN** a serverless room whose host disconnected and whose guests are idle
- **WHEN** the grace period and one reaper run pass
- **THEN** every guest receives `session:closed` with `host_timeout`
