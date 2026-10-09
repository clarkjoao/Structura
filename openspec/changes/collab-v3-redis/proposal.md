## Why

Live collaboration is unstable enough that people stop trusting it. Guests keep resyncing, and
after a reconnect the host can be left with nothing but the last node someone moved. Reproduced
against the current TypeScript relay (`server/src/collab.ts`, protocol v2) with a Playwright
host + guest harness:

1. **A guest that reconnects without having missed anything hangs on "Syncing…".** The server
   answers the resume with `operations: []`. `applyResumeOperations` reads an empty list as "no
   replay", the message carries no snapshot, and the `session:init` branch of
   `src/features/collaboration/hooks/useCollab.ts` returns before `setIsReady(true)`.
2. **The guest page dies when the host reconnects.** `host:reconnecting` unmounts the guest
   canvas (`CollabRoom.tsx`), and `host:reconnected` mounts it again. React Flow then throws
   "Maximum update depth exceeded" in `StoreUpdater`.
3. **Rooms split across instances.** The relay keeps rooms in process memory. Behind any load
   balancer with more than one instance, a reconnecting host lands on an instance that has never
   seen the room and silently creates a new one (`resumed:false`, version 0). Host and guests then
   edit two different rooms.

The design also lets the server replace the host's diagram wholesale: `PERIODIC_SNAPSHOT`,
`SYNC_SNAPSHOT` and the resumed `host:ack` all go through `onSnapshot`, which rebuilds the diagram
from scratch and drops untracked fields such as `folderId`. So any inconsistency in server state
turns straight into data loss on the host. There are two more limits:

- The 100 KB inbound cap rejects `host:join` for diagrams past roughly 80–200 nodes. The seed
  diagrams measure 0.3–1.3 KB per node.
- Store sync flushes through `requestAnimationFrame`, which stalls in background tabs.

The target is now explicit: a Kubernetes deployment, with several pods and autoscaling, that
holds **500 people across 35 documents at once**. That means up to 50 editors in a room, 20 of
them dragging simultaneously, and recovery within 5 seconds when a pod dies. Patching v2 cannot
meet that target, because its room state lives in one process.

## What Changes

- **BREAKING:** Collaboration protocol **v3** replaces v2. The server refuses v2 clients at join.
  The v2 relay (`server/src/collab.ts`), the client sync hooks (`useCollab.ts`,
  `useCollabStoreSync.ts`) and the v2 protocol doc are rewritten from scratch. The UI components
  (modals, cursors, toolbar, status indicator) are kept and rewired.
- **The server becomes the source of truth during a session.** The host's workspace stays the
  source of truth outside a session: it seeds the room when the session opens and receives the
  final state when the session ends.
- **Relay pods hold no session state.** Room state, ordering and fan-out live behind a
  `RoomStore` / `Bus` interface with two adapters:
  - **in-memory**: the default, for a single instance and the public build;
  - **Redis**: selected by `REDIS_URL`. It stores state per entity field in Hashes, applies each
    patch atomically in a Lua script (merge, then version `INCR`, then `XADD`), keeps a per-room
    Stream that gives total order, replay and resume, and uses pub/sub to fan out across pods.
- **Field-level merge.** Concurrent edits to different fields of the same entity both survive.
  Remove-wins-over-concurrent-edit (tombstones) is kept.
- **Session lifecycle:**
  - The host closing on purpose (the end-session action) ends the session for
    everyone, and guests are offered to import their local copy.
  - A dropped host does not freeze the room: everyone keeps editing for a 30 s grace period, after
    which the session closes.
  - The room holds up to 50 participants, all of them editors.
- **Host credential.** The server issues a secret `hostToken` when the room is created. Only that
  token can reconnect as host, reseed or close the session. The link stays the capability for
  joining.
- **Reseed.** When the server _confirms_ a room is unknown (for example after Redis lost it), the
  host recreates the room from its local copy. It never reseeds on suspicion.
- **Large diagrams.** Diagrams of up to ~1,000 nodes, icons and version history included, are
  transferred in chunks both ways: `seed:chunk` from the host, and a chunked snapshot to joiners.
  The UI states the size limit instead of hanging on "connecting".
- **Soft locks.** Dragging a node or editing its text takes a short lock (a TTL that is renewed
  while the gesture lasts). Every other concurrent edit is last-writer-wins, with a visual
  indication of who is editing.
- **Client sync rewritten:**
  - inbound patches are applied from the socket handler, not `requestAnimationFrame`;
  - outbound diffs are per field;
  - drags are throttled to about 10 Hz and always send the final position;
  - resume and reseed are explicit.
  - The two client bugs above are fixed.
- **Deployment and proof:**
  - a Docker Compose harness (several relay replicas, Redis and a round-robin proxy) runs the
    acceptance suite in CI;
  - Kubernetes manifests and a kind run ship in the standalone relay project
    (`structura-wbsocket-server`, which syncs the relay source from `server/`).
- **Removed:** the Go port (`server/go/`). It mirrors v2 and would document a protocol that no
  longer exists. A Go server is rebuilt later from the v3 spec and the shared Lua script.

## Non-Goals

- Editor/viewer roles, host migration, or sessions that outlive the host.
- Accounts, login or SSO inside Structura. Access control beyond the link belongs to the ingress
  (for example oauth2-proxy).
- CRDT/Yjs, or offline editing for guests. A guest's unconfirmed edits are discarded on a drop
  and its state is refetched.
- Any specific managed or cloud deployment (API Gateway, Lambda, DynamoDB), and the Go port
  itself.
- Collaboration on workspace-level data (folders, service catalog, model index). Rooms stay per
  diagram.
- Redis high availability as code. Sentinel, a Redis operator or AOF persistence are deployment
  choices; the protocol stays correct without them through host reseed.

## Capabilities

### New Capabilities

- `collab-session`: room lifecycle — create, join, capacity, `hostToken`, host drop grace,
  intentional close, reseed after a confirmed loss, and the guest's import-local-copy exit.
- `collab-sync`: how diagram state moves and converges — v3 patches, server ordering,
  field-level merge, tombstones, resume from a version, chunked seed and snapshot transfer, size
  limits, and the client's application of remote state.
- `collab-presence`: cursors, who-is-editing indicators and soft locks on drag and text edit.
- `collab-relay`: the server as a stateless deployable — `RoomStore`/`Bus` adapters (in-memory,
  Redis), multi-instance behaviour, rate limits, and the measurable resilience and load targets
  with the harness that proves them.

### Modified Capabilities

None. Collaboration has no spec yet under `openspec/specs/`.

## Impact

- **Server:** `server/src/collab.ts`, `snapshotChecksum.ts` and `index.ts` are replaced by a
  `server/src/collab/` module. New dependency `ioredis` (or `redis`). New `server/src/collab/lua/`.
  `server/go/` is deleted. `server/loadtest/` is reworked for v3.
- **Client:** `src/features/collaboration/hooks/*` and `utils/snapshotChecksum.ts` are replaced by
  a new sync layer. `CollabProvider.tsx` and `CollabRoom.tsx` are rewired. The canvas presence
  hooks (`usePeerOnNode`, `CollabPeerPresence`, `CollabEdgeHighlight`) gain lock state. New UI
  strings go in `en` and `pt-BR`.
- **Tests and tooling:** new server tests run against both adapters. The Playwright harness under
  `scripts/` and a Compose stack (`deploy/compose/`) run the acceptance suite. A CI job is added.
- **Docs:** `docs/collab-websocket-protocol.md`, `docs/collab-entity-patches.md`,
  `docs/collab-architecture-study.md` and `docs/concepts/collaboration.md` are rewritten or
  retired. A new ADR records the move to server authority backed by Redis.
- **Operators:** `REDIS_URL` is optional. Without it the relay runs as a single instance and loses
  rooms on restart, recovered by host reseed.
