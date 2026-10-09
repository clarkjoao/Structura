# ADR-0011 — Live sessions: the relay's store is the source of truth during a session

**Status:** Accepted

## Context

Live collaboration was a WebSocket relay that kept each room's snapshot, version and operation
log in process memory (protocol v2). Two things broke it:

- **The relay could overwrite the host.** A snapshot from the relay replaced the host's diagram
  wholesale, so any inconsistency in the relay's state became data loss on the host.
- **More than one relay instance split rooms.** Behind a balancer, a host or guest that
  reconnected to another instance found no room there, or a different one.

Reproduced in the field as "the host loses the diagram except the last moved node". The target
became a Kubernetes deployment holding 500 people in 35 documents, with up to 50 editors per room
and recovery from a pod death within 5 seconds.

Three directions were weighed:

- **Host-authoritative relay.** The host's tab orders every edit; the relay is a pure pipe.
  - Simplest relay.
  - The host tab becomes the bottleneck for 50 editors and freezes in background tabs, and a
    host drop freezes the room.
- **CRDT (Yjs).** Symmetric and offline-friendly.
  - The diagram model would become a Yjs document.
  - A Go relay would depend on a much weaker Yjs port.
- **Relay authority over shared storage.** The relay orders edits and keeps the room in Redis,
  and relay pods hold no state.

## Decision

1. **During a session, the room in the relay's store is the source of truth.** Outside a session,
   the host's workspace is. The host seeds the room from its diagram and keeps applying every
   entry, so its local copy always holds the latest state.
2. **Relay pods are stateless.** Rooms live behind a `RoomStore`, implemented twice:
   - in-memory: single instance, the default, for the public build;
   - Redis, selected by `REDIS_URL`.

   The Redis implementation applies each patch atomically in one Lua script
   (`server/src/collab/store/lua/apply.lua`): field-level merge, remove-wins over a stale edit,
   soft-lock guarding, then version plus stream entry. A per-room Redis Stream gives total order,
   replay and resume. One suite holds both stores to the same fixtures.
3. **The host owns the session:**
   - ending it on purpose ends it for everyone;
   - a dropped host has a 30 s grace period, during which the room keeps working;
   - a server-issued `hostToken` guards host powers;
   - if storage loses a room, the host reseeds it, and only after the relay confirms the room is
     unknown. A room recreated this way gets a new epoch, so no client resumes old versions into it.
4. **Protocol v3** replaces v2 outright. v2 clients are refused at join.

## Consequences

- Any number of relay pods can serve a room, and losing one costs only its sockets. Measured: 500
  participants, a pod deleted mid-load, everyone editing again in under a second, nobody diverged.
- **Redis is now a dependency** for multi-instance deployments, and the one stateful component.
  Without persistence, a Redis restart costs at most in-flight edits, because hosts reseed.
  Persistence or a managed Redis is a deployment choice.
- **Redis Cluster is not supported.** The scripts derive keys at runtime, and the fan-out reader
  watches many streams in one `XREAD`.
- The merge rules live in two places, `merge.ts` and `apply.lua`, which the shared fixture suite
  keeps equal. A future Go relay reuses the Lua script and the fixtures, not a third
  reimplementation.
- **A host who closes the tab ends the session only after the grace period.** A page cannot tell
  a close from a reload, and a reload must resume.
- Supersedes the collaboration notes in `concepts/collaboration.md`, which described Yjs, a design
  that was never implemented.
