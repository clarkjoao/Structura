# Design

## Context

See proposal.md (Why) for the failures that motivate this change and specs/ for the required
behaviour. The design has to work under these constraints:

- **Today's relay keeps everything in one process.** `server/src/collab.ts` holds the room
  snapshot, the version, the operation log and the tombstones in memory. The client trusts any
  snapshot the relay sends and rebuilds the diagram from it (`CollabProvider.onSnapshot`).
- **The client sync layer is a pile of patches** (`useCollab.ts`, 1,170 lines): replay, a gap
  detector, a checksum repair, a rate-limit requeue and a pending-ops cap. Both reproduced client
  bugs sit in those seams.
- **The diagram model:** `Diagram { snapshot: { components, connections, flows, iconLibrary },
nodeLayouts, edgeLayouts, versions, activeVersionId, compareVersionId, name, domain,
description, … }`. The collections are records keyed by entity id, and the entities are flat
  enough for a one-level field merge.
- **Two deployment targets:** a single public instance with no infrastructure, and Kubernetes with
  N pods, an HPA and Redis.
- **Repo hard rules:** strict TypeScript with no `any` and type guards, all UI strings through
  i18n, persistence only through `IStoragePort`, and `pushHistory` reserved for the user's own
  mutations.

## Goals / Non-Goals

**Goals:**

- No relay pod holds state it cannot afford to lose.
- One protocol and one merge implementation (Lua) shared by every server implementation.
- A client sync layer that is a plain-TypeScript state machine, testable without React.
- Every spec scenario backed by an automated test: a server unit test on both adapters, a client
  unit test, or the Playwright/Compose harness.

**Non-Goals:**

- A generic CRDT, operational transformation, or merging below one level inside an entity.
- Redis Cluster. Every key of a room shares a hash slot, but the scripts derive entity keys at
  runtime and the fan-out reader watches many rooms in one `XREAD`; both assume a standalone
  (or Sentinel-managed) Redis.
- Durable session history. A room ends when its host closes it or stays away past the grace
  period; nothing about it outlives that.

## Decisions

### D1 — Redis is the source of truth during a session; storage sits behind `RoomStore`

`RoomStore` is the only interface the session handlers call:

- `createRoom`;
- `seed` (`begin` / `chunk` / `commit`);
- `applyPatch(room, patch, senderVersion, senderId)` → `{ version, effective }`;
- `readSnapshot(room)` → `{ version, state }`;
- `readOps(room, fromVersion)`;
- `subscribe(rooms, fromVersion)`;
- locks: `acquire` / `renew` / `release`;
- host lease: `renew` / `expire`;
- `closeRoom`.

There are two adapters: `MemoryRoomStore` and `RedisRoomStore`. **One test suite runs against
both.** The memory adapter is the specification by example, and the Redis adapter has to match it.

_Rejected:_

- A host-authoritative pure relay. The host tab becomes the bottleneck for 50 editors, it freezes
  in background tabs, and a host drop freezes the room.
- Rooms in memory with hash routing at the ingress. An HPA scale event splits rooms, because
  existing sockets stay on the old pod while new ones hash to the new pod.
- Yjs, which would mean rewriting the model, with weak Go support.

### D2 — Redis layout, one hash slot per room

Every key carries the `{roomId}` hash tag:

| key                               | type       | content                                                                                                                |
| --------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `c:{r}:meta`                      | Hash       | `status` (seeding/open/closed), `version`, `hostTokenHash`, `hostUser`, `seedChunks`, `createdAt`, `hostOnline`        |
| `c:{r}:doc`                       | Hash       | top-level scalars: `diagramName`, `domain`, `description`, `level`, `activeVersionId`, `compareVersionId`, `diagramId` |
| `c:{r}:idx:<collection>`          | Set        | entity ids in the collection                                                                                           |
| `c:{r}:e:<collection>:<entityId>` | Hash       | field → JSON-encoded value, plus an empty-named presence marker so an entity with no fields still exists               |
| `c:{r}:tomb`                      | Hash       | `<collection>/<entityId>` → version of the delete                                                                      |
| `c:{r}:ops`                       | Stream     | `<version>-0`: `kind=entry`, `opId`, `sender`, `patch` (effective, wire form); `<version>-1`: `kind=closed`, `reason`  |
| `c:{r}:lock:<entityId>`           | String     | holder clientId, `PX 3000`                                                                                             |
| `c:{r}:seed`                      | Hash       | chunk index → text, until commit                                                                                       |
| `c:{r}:members`                   | Hash       | clientId → `<expiresAt>\|<connId>\|<participant JSON>`; relays renew their members, so a dead relay's members expire   |
| `collab:hostlease`                | Sorted set | roomId → host lease expiry (ms). Global, the only key outside a room slot                                              |

Using the version as the stream id (`XADD … <version>-0`) makes "resume from version N" an
`XRANGE (N-0 +`, with no index to keep. The stream is trimmed to about 2,000 entries. A resume
older than the trimmed tail gets the full snapshot.

_Rejected:_

- One Hash per collection with `entity\0field` keys. Deleting an entity then means scanning its
  fields.
- One JSON document per room. Field merge would mean reading and writing the whole document on
  every drag.

### D3 — A Lua script applies each patch atomically

`apply.lua` takes the patch JSON, the sender's version, the sender id and the time, and inside
the one atomic call:

1. checks `status == open`;
2. for each entity it applies the tombstone rule:
   - `null` → `DEL` the entity, `SREM` it from the index and record the tombstone;
   - a write to a tombstoned entity whose sender version is older than the delete → dropped;
3. checks locks: fields that need the lock (`x`, `y`, `width`, `height` on nodeLayouts; the text
   fields on components and connections) are dropped when another client holds the entity's lock;
4. merges the remaining fields with `HSET`, and `HDEL`s fields whose value is JSON `null`;
5. if anything took effect, runs `INCR version` and `XADD` with the effective patch;
6. returns `{ version, effective }`.

The memory adapter implements the same steps in TypeScript. A shared fixture suite of 40+
patch/expected-state cases runs on both. **The Lua file is the artifact a future Go server
reuses as is.**

### D4 — Fan-out reads the Stream; pub/sub carries only ephemeral traffic

Each pod runs one `XREAD BLOCK` loop over the streams of the rooms it has local sockets in,
tracking the last id per room. It forwards every entry to its local sockets, the sender
included. A Redis reconnect resumes from the last ids, so no edit is lost and none arrives out of
order.

Cursors, lock notices and presence go over pub/sub (`c:{r}:presence`), because they are lossy by
nature. Each pod coalesces cursors per room every 50 ms before publishing.

_Rejected:_

- Pub/sub for edits. It is at-most-once: a pod that loses its subscription silently loses edits,
  and the client would need gap detection again.

### D5 — Seeding and snapshots move in chunks

**Seeding:**

1. The host sends `seed:begin {bytes, chunks}`.
2. Then 64K-character `seed:chunk` frames, stored in `c:{r}:seed`.
3. Then `seed:commit`. A second script parses the joined JSON, writes the entities and flips
   `status` to open at version 0.
4. Guests that join before the commit get `not_ready` and retry.

**Joining:** the snapshot is read in one Lua call, so it is consistent at a single version. It is
sent to the joiner as `snapshot:chunk` frames followed by `snapshot:end {version}`, and live
entries from the stream past that version follow.

**Limits:** 8 MB per seed, configurable, and 256 KB for any other frame. The client measures the
serialised diagram before starting and shows the too-large message locally.

### D6 — Host lease, grace and close without a coordinator

- **Host lease.** The pod holding the host's socket renews the room's score in `collab:hostlease`
  to now+10 s every 3 s. A host disconnect stops the renewals.
- **Reaper.** Every pod runs a reaper each second. It looks for rooms whose lease expired more
  than 30 s ago and calls `close.lua`. The first pod to call it wins, because the script checks
  `status`.
- **Close.** `close.lua` sets `status=closed`, `XADD`s a `close` entry so every pod notifies its
  sockets, and sets a 60 s expiry on the room keys.
- **Intentional close.** `close` from the host's socket runs the same script immediately. The
  client sends it only from the end-session action. Closing the tab sends nothing: a page cannot
  tell a close from a reload, and a reload must resume (the credential is in `sessionStorage`).
  The lease reaper ends a closed tab's session within the grace period, which is what the
  "host closes the tab" scenario allows.
- **No idle expiry.** A room lives exactly as long as its host keeps it (lease + grace); a host
  who stays connected keeps the room, however quiet.

### D7 — `hostToken`

The token is 32 random bytes in base64url. It is returned only in the creator's `room:created`
frame. Redis stores its SHA-256 (`hostTokenHash`) and comparisons are constant-time. The client
stores the token in `sessionStorage` under the roomId, so a reload of the host tab reconnects as
host and a new tab does not.

### D8 — Reseed only on an explicit `room_unknown`

`room_unknown` is a distinct error code. The relay sends it only when `c:{r}:meta` does not exist.
Any other failure is retried: a timeout, a closed socket, a Redis error answered as
`unavailable`. The client reseeds only when it is the host, holds the token, and has received
`room_unknown`.

**Token check on reseed.** When a room is unknown, no stored hash exists to check the token
against. On reseed the client therefore sends the token itself, and the server re-creates the
room under the same id and that token's hash. If the room exists again by then, because someone
else reseeded first, the reseed is refused as `room_exists`.

**Risk.** Someone who knows a lost room's id could race the host to recreate it. This is recorded
under Risks.

### D9 — The client is a plain-TypeScript state machine plus a store bridge

`src/features/collaboration/sync/` has three parts.

**`CollabClient`** owns the socket and the states
`idle → connecting → seeding | joining → ready ⇄ reconnecting → closed`. Every transition is
explicit. "Ready" is entered by one code path, after either `snapshot:end` or an empty or
non-empty catch-up. That fixes the stuck guest by construction.

**`StoreBridge`** connects the diagram store:

- **Outbound.** A store subscription computes the per-field diff of the synchronised fields
  against a _confirmed_ baseline and queues it. The send loop runs on a timer, not
  `requestAnimationFrame`, and coalesces at 100 ms for drags, with an immediate send on drag end.
- **Inbound.** Applied directly from `onmessage` through a store action that does not call
  `pushHistory`, and that writes only synchronised fields, leaving `folderId`, `viewport`,
  `createdAt` and the rest untouched.
- **Rebase.** The bridge keeps local unconfirmed fields as a _pending overlay_. On every inbound
  entry it applies the entry to the confirmed state and then re-applies the pending overlay. The
  user's own in-flight drag therefore never snaps back to an older echoed position. An entry from
  this client confirms and drops the matching pending fields.

**React hooks** are thin adapters over these two parts. `CollabProvider` keeps its public context
shape where it can, and drops the dead `provider: null` / `ydoc: null` fields.

### D10 — The canvas is not unmounted on host reconnecting

`CollabRoom` keeps the canvas mounted and shows the reconnecting state as an overlay. This
removes the trigger of the React Flow "Maximum update depth exceeded" crash. The loop itself also
gets a root-cause investigation with a regression test. A remount must not crash either, because
a reload or navigation remounts the canvas anyway.

### D11 — Soft locks

On drag start or text-edit start, the client sends `lock:acquire {entityId}`, and the relay runs
`SET c:{r}:lock:<id> <clientId> NX PX 3000`. Both the grant and the current holder are published
on presence, so peers know locks before they try. While the gesture lasts, the holder renews
every second. `lock:release` is sent on gesture end.

The client blocks a drag start when presence shows another holder. In a race it starts
optimistically, and if the server denies the lock it reverts and shows the holder. The Lua script
(D3) is the authority. It drops lock-guarded fields from anyone who is not the holder, so a client
bug cannot bypass the lock.

### D12 — The protocol drift detector is dropped

Total order from the Stream, inclusive fan-out and a single merge implementation leave nothing
for a checksum to detect in a correct system, and the v2 checksum code added three guards just
to avoid false alarms. Convergence becomes a property the harness asserts: after each run it
compares every client's synchronised state with `readSnapshot` byte for byte. A debug-only
`state:hash` request stays available for the harness.

### D13 — Rate limits and backpressure live in the pod

A connection is pinned to its pod for its whole life, so per-client limits are in-memory token
buckets with no Redis round trip:

- 30 edits/s sustained, with a burst of 60;
- 20 cursor updates/s;
- frames capped at 256 KB (seed chunks at 64 KB).

Outbound backpressure works as in v2: lossy frames (cursors, presence) are dropped above 1 MB
queued, and state frames never are. A socket above 8 MB queued is closed, and the client reconnects
and resumes.

### D14 — The proof harness

- `deploy/compose/`: 3 relay replicas, Redis 7 and an HAProxy in round-robin, plus a load driver.
- `scripts/collab-*.mjs`: the Playwright scenarios, rebuilt from the session's
  `collab-reconnect` harness.
- `server/loadtest/`: the protocol-level load driver for 500 connections in 35 rooms.

A CI job runs the Compose suite on every PR. The Kubernetes manifests (Deployment with HPA,
PodDisruptionBudget and a preStop drain, Service, an ingress-nginx Ingress with WebSocket timeouts,
and a Redis StatefulSet with optional AOF) live in the separate deployment project
`structura-wbsocket-server`, together with the kind scripts that run the suite against them. That
project holds no relay code: it builds the image from `server/` and runs the harness from there.

## Risks / Trade-offs

- **[Large seeds block Redis]** A 1,000-node seed parses and writes in one Lua call, a few ms of
  Redis time. → The seed commit is measured in the harness. Above 20 ms, the script switches to
  writing in batches of 200 entities while the room stays in `seeding`.
- **[A hot room]** 20 draggers at 10 Hz is about 200 Lua calls/s, each well under 0.1 ms. → It is
  measured, with headroom asserted at 3× the target.
- **[Rebase overlay complexity]** The pending overlay is the one subtle piece of the client. →
  It is a pure function `(confirmed, pending, entry) → (confirmed', pending')` with exhaustive
  unit tests: concurrent drag, delete under a pending edit, lock denial revert.
- **[Reseed race on a lost room id]** See D8. → Accepted. It requires both a Redis loss and an
  attacker who knows the room id. The room password left open as a follow-up would close it.
- **[A closed host tab ends the session only after the grace period]** → Accepted: it is the
  price of a reload resuming. Ending the session explicitly is immediate.
- **[Root cause of the React Flow loop unknown]** → D10 removes the trigger in collaboration. A
  separate task reproduces the remount loop in isolation and fixes or reports it.
- **[Redis as a critical dependency]** → Host reseed makes a Redis loss recoverable. HA is an
  operator choice documented in the relay project's README.

## Migration Plan

1. All work happens on `feat/collab-v3` from `main`, with one commit per milestone (see
   tasks.md) and a single PR.
2. Server and client deploy together. v3 refuses v2 joins, so a stale tab gets an
   "update the app" message instead of corrupting a room.
3. Sessions are ephemeral, so no data migrates. Rollback means redeploying the previous server
   and app images. Rooms open at the time are lost, and hosts keep their local diagrams.
4. `server/go/` and the v2 docs are removed in the same PR. A new ADR records D1.
