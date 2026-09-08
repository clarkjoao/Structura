# Structura collaboration relay — WebSocket protocol specification

> Audience: an engineer or a language model that has to reimplement, extend or
> debug this server without reading its source. Everything below is derived from
> `server/src/collab.ts` at protocol version 2, and is mirrored by the Go port
> in `server/go/collab.go`.

## 1. What this server is

A **relay with a snapshot**, not a CRDT and not an OT engine.

- The server holds the authoritative copy of one diagram per room.
- Clients send sparse patches; the server applies them in arrival order,
  assigns a version, and fans the result out to everyone.
- Conflict resolution is last-writer-wins **per entity**, with one exception
  (remove-wins, §6.3).
- There is no persistence. A room lives as long as its host connection, plus a
  10-second grace window.

The endpoint is a single WebSocket path (default `/ws`, from `WS_PATH`). Every
frame is a JSON object with a `type` field. There is no binary framing, no
subprotocol negotiation, and no HTTP API.

## 2. Roles and lifecycle

A connection is anonymous until it sends `host:join` or `guest:join`. From then
on the server keeps a socket state for it: `{roomId, clientId, role}`.

```
                 host:join (new roomId)
   [anonymous] ────────────────────────► [host]  ── room created
                 guest:join (existing)
   [anonymous] ────────────────────────► [guest] ── added to room

   host socket closes  ──► guests get host:reconnecting
                           10s grace window starts
                             ├─ host:join again → host:ack{resumed:true},
                             │                    guests get host:reconnected
                             └─ timeout → room closed, guests get
                                          host:disconnected, sockets closed

   host sends host:close ──► guests get session:closed, sockets closed
   guest socket closes   ──► everyone else gets peer:left
```

**Capacity:** 15 participants (1 host + 14 guests). A 16th `guest:join` is
answered with `room_full` and the socket is closed.

**Guest id collision:** if a guest's declared `user.id` equals the host's id or
an existing guest's, the server appends a random suffix. The assigned id comes
back in `session:init.clientId`, and the client must use that one, not the id it
asked for — coalesced cursor frames include the recipient's own entry and this
is what it filters on.

## 3. Protocol version gate

`COLLAB_PROTOCOL_VERSION = 2`. Both join messages must carry `protocol: 2`; a
missing field is read as 1.

A mismatch is answered with `error{code:"protocol_mismatch"}` and the socket is
closed with status 1008.

This gate exists because v2 made patches sparse and per entity — a change that
is **invisible in the message shape**. A v1 client would read "these entities
changed" as "the collection is now only these" and wipe the user's diagram.
Refusing the join is the only safe reading of an ambiguous frame.

## 4. Message reference

### 4.1 Client → server

| type | required | optional | notes |
|---|---|---|---|
| `host:join` | `protocol`, `roomId`, `user`, `snapshot` | `diagramId`, `resumeFrom` | Creates the room, or reclaims one whose host dropped. |
| `guest:join` | `protocol`, `roomId`, `user` | `resumeFrom` | |
| `host:patch` | `roomId`, `patch` | `operationId`, `version`, `batched` | |
| `guest:patch` | `roomId`, `patch` | `operationId`, `version`, `batched` | |
| `host:close` | `roomId` | | Ends the session for everyone. |
| `peer:cursor` | `roomId`, `cursor` | `activeElementId` | `cursor` may be `null`; **absent is an error**. |
| `sync:request` | `roomId` | `baseVersion`, `reason` | `reason:"checksum"` forces a full snapshot. |
| `ping` | | | Answered with `pong`. Unrelated to the server's own heartbeat. |
| `pong` | | | Answer to the server's `ping`. |

`user` is `{id, name, color}` — all three required, all strings, or the join is
rejected.

### 4.2 Server → client

| type | fields | sent to |
|---|---|---|
| `host:ack` | `resumed`, `protocol`, `version`, and one of `snapshot` \| `operations` | the joining host |
| `session:init` | `protocol`, `clientId`, `participantCount`, `maxParticipants`, `version`, `hostUser`, `peers`, and one of `snapshot` \| `operations` | the joining guest |
| `peer:joined` | `clientId`, `user`, `participantCount`, `maxParticipants` | everyone **except** the joiner |
| `peer:left` | `clientId`, `participantCount`, `maxParticipants` | everyone |
| `session:patch` | `patch`, `operationId`, `version`, `clientId` (guest patches only) | **everyone, sender included** — see §7.1 |
| `OP_ACK` | `operationId`, `version`, `accepted` | the sender only |
| `peer:cursors` | `roomId`, `cursors[]` | everyone, lossy |
| `sync:checksum` | `version`, `checksum` | everyone |
| `SYNC_SNAPSHOT` | `version`, `snapshot`, `snapshotVersion` | the requester |
| `SYNC_COMPLETE` | `version`, `operations[]` | the requester |
| `PERIODIC_SNAPSHOT` | `version`, `snapshot` | everyone |
| `host:reconnecting` / `host:reconnected` | — | guests |
| `host:disconnected` / `session:closed` | — | guests, then sockets closed |
| `ping` / `pong` | — | |
| `error` | `code`, `message` | the offender |

### 4.3 Error codes

| code | closes socket | meaning |
|---|---|---|
| `invalid_json` | no | unparseable, or over the 100KB payload cap |
| `missing_type` | no | no `type` field |
| `unsupported_message` | no | unknown `type` |
| `protocol_mismatch` | **yes** (1008) | client is not v2 |
| `invalid_host_join` / `invalid_guest_join` | no | malformed `user`, `roomId` or `snapshot` |
| `room_exists` | **yes** (1008) | a live host already holds that room |
| `room_not_found` | no | no such room |
| `room_full` | **yes** (1008) | 15 participants already |
| `invalid_host_patch` / `invalid_guest_patch` | no | no socket state, wrong room, or a rejected patch |
| `invalid_host_close` | no | not the host, or wrong room |
| `invalid_peer_cursor` | no | malformed or absent cursor |
| `invalid_sync_request` | no | no socket state, or wrong room |
| `rate_limited` | no | over 50 ops/second |
| `batch_too_large` | no | `batched` > 10 |

## 5. Versioning

`room.version` is a monotonic counter, incremented once per accepted patch. It
is **not** a vector clock and carries no causality: it is a sequence number for
the single ordered stream the server produces.

Clients send the version they had applied when they composed the patch. The
server uses it for exactly one decision — whether the sender had already seen a
delete (§6.3). **It must never be used to detect loss.**

> On an ordered, reliable socket a connected client cannot miss a broadcast. A
> version difference at the server is concurrency and in-flight latency, and
> from the server's position that is indistinguishable from real loss. An
> earlier revision treated the difference as a gap and asked the client to
> resync: measured under load that fired on ~5% of all patches — 23,800
> `SYNC_REQUIRED` messages in 30 seconds and 137,181 operations replayed to
> clients that had missed nothing. It was also harmful rather than merely
> wasteful, because a replayed operation carries the entity value it had at the
> time, so re-applying history reverts a client's own newer edit.

## 6. The patch format

### 6.1 Shape

A patch is a flat object whose top-level keys are diagram fields:

```json
{
  "nodeLayouts": { "cmp_7": { "elementId": "cmp_7", "x": 120, "y": 300 } },
  "components":  { "cmp_9": null },
  "diagramName": "Renamed"
}
```

### 6.2 Merge rule — structural, not a list of names

For each top-level key:

- **value is a JSON object** → treat it as an entity collection: merge one level
  into the snapshot, where a `null` entry **deletes** that entity (a tombstone);
- **anything else** (string, number, boolean, array, null) → assign whole.

This is deliberately structural so adding a collection to the domain needs no
server change. The invariant it depends on: *every object-valued key at the top
level of a patch is a keyed collection of entities.* Whole-state transfers never
come through this path — they arrive in `snapshot` fields, which replace
outright.

Nesting deeper than one level is **not** merged. Two users editing different
fields of the *same* entity still contend; last writer wins the whole entity.

### 6.3 Remove wins over a concurrent edit

The server records, per room, the version at which each entity was deleted
(`tombstones: collection → entityId → version`).

When a patch writes to an entity that carries a tombstone:

- the sender declared a version **older** than the delete → the write is
  **dropped** (it had not seen the delete);
- the sender declared a version **at or after** the delete → the write is
  honoured and the tombstone cleared (it is deliberately re-creating the entity);
- the sender declared **no** version → the write passes (it cannot be evaluated).

> Without this, a peer mid-drag brought back a node someone else had deleted.
> Worse than a plain resurrection: a delete spans several collections while the
> in-flight edit usually touches one, so the entity returned **orphaned** — a
> layout with no component — and accumulated in the room snapshot.

Tombstones are pruned when a snapshot is taken: anyone behind the snapshot is
served the snapshot itself, so those deletes can no longer be contradicted.
Memory stays bounded without a TTL.

### 6.4 Effective patch

`applyPatch` returns **the portion that actually took effect**, which may be
narrower than what arrived. The server broadcasts and logs *that*, never the
patch it received.

> Retransmitting the original would have peers apply a write the server
> suppressed, so they would drift from the server's own snapshot with no error
> surfacing anywhere.

If the effective patch is empty, no `session:patch` is broadcast at all — but
the version has still been consumed and `OP_ACK` is still sent, so the sender is
never left waiting.

## 7. Fan-out

### 7.1 The sender is included

`session:patch` goes to every participant **including the client that sent it**.

> Excluding the sender left a hole in the only ordered view it has of the room.
> B moves a node at v10 and A moves the same node at v11; the server keeps A's
> value, but A receives B's older patch after having sent its own and applies
> it. v11 never reaches A, so A settles on B's value while the room holds A's,
> permanently. Measured: 3 of 13 guests diverged every run from this alone.

There is no echo problem on the client, because it advances its diff baseline by
the same patch, so its next diff finds nothing to send.

The exclusion stays where it belongs: on `peer:joined`, which the joiner must
not receive about itself.

### 7.2 Serialise once per room

A broadcast serialises the payload **once** and sends the same bytes to every
recipient. Serialising per recipient meant a 15-seat room paid 14 encodings for
one identical frame; with whole-collection patches that was the relay's dominant
cost.

### 7.3 Backpressure and lossy frames

Frames are marked lossy or not:

- **lossy** (`peer:cursors` only): dropped when the recipient has more than 1MB
  queued. The next frame supersedes it anyway.
- **not lossy** (everything state-bearing): always queued, however backed up the
  client is.

## 8. Cursors

`peer:cursor` is **coalesced, not relayed**. The server keeps only the newest
position per client and flushes the whole room once per 50ms tick as a single
`peer:cursors` frame carrying every pending entry.

> Relaying each cursor immediately cost one send per peer per event: a full room
> at 30Hz was 6,300 sends/s from one room alone. Coalescing makes it 15 sends
> per tick regardless of how fast anyone moves, which is what lets 50 rooms
> share one event loop.

The frame includes the recipient's own entry — that is what lets the room pay
one encoding. Clients drop their own by `clientId`.

`cursor: null` means "the pointer left the canvas". An **absent** `cursor` field
is malformed and answered with `invalid_peer_cursor`.

## 9. Operation log, snapshots and resume

### 9.1 The log

Every accepted operation is appended as
`{version, operationId, clientId, patch, timestamp, bytes}`, where `patch` is the
*effective* patch and `bytes` is the inbound frame size.

Two budgets, both enforced by evicting oldest-first:

- at most **1000** operations;
- at most **2MB** of them.

> The byte budget is what actually bounds the relay's heap. Under the count cap
> alone, a busy room on a large diagram could hold hundreds of MB.

### 9.2 Snapshots

A `PERIODIC_SNAPSHOT` is broadcast when either fires:

- **100 operations** since the last snapshot (checked after every patch), or
- **5 minutes**, if anything happened (a timer per room).

Taking one moves `snapshotAtVersion`, trims the log to operations newer than the
*previous* marker, and prunes tombstones.

### 9.3 Resume

Both joins accept `resumeFrom: <version>`. The server replays only the missed
operations instead of the whole diagram — on a 300-node diagram with five edits
lost during a drop, the rejoin frame goes from 22.4KB to 1.0KB.

Replay is refused (and the full snapshot sent) when any of these hold:

- `resumeFrom < 0` or `> room.version`;
- `resumeFrom < room.snapshotAtVersion` — the log no longer reaches back;
- the log holds no operation newer than `resumeFrom`;
- **the oldest held operation is not exactly `resumeFrom + 1`** — there is a hole
  in the middle, and replaying across it would silently skip operations.

`resumeFrom == room.version` replays an empty list, which is still a resume.

> **The safety condition is the whole design.** The client's `sendRaw` silently
> drops frames when the socket is down, so an edit made offline is applied
> locally and never reaches the server. A full snapshot overwrites it — the edit
> is lost, but the two sides agree. A replay would instead let that edit survive
> locally and diverge with nothing to signal it, which is worse than losing it.
> So a client must claim a resume **only** when its local state provably equals
> the version it declares.

### 9.4 `sync:request`

| condition | answer |
|---|---|
| `reason == "checksum"` | `SYNC_SNAPSHOT` — always |
| `baseVersion < snapshotAtVersion` | `SYNC_SNAPSHOT` |
| otherwise | `SYNC_COMPLETE` with operations newer than `baseVersion` (possibly empty) |

A checksum mismatch means the *content* is wrong, not that operations are
missing — the client is usually at the right version, so a replay would send it
nothing.

## 10. Drift detection (checksum)

Versions alone cannot tell a client whether it still agrees with the room: it
can be at the right version and hold a stale entity, which is exactly how
divergence went unnoticed.

The server broadcasts `sync:checksum {version, checksum}` when either fires:

- **25 operations** since the last fingerprint, or
- **2 seconds of silence** after any operation.

> The idle trigger is not redundant. Publishing only every N operations leaves
> the last window of a burst unverified: the room goes quiet, no further
> fingerprint is sent, and a client that drifted on one of those final
> operations stays wrong with nobody looking. Found by measurement — a run with
> 1 of 13 guests divergent and **zero** resync requests.

The fingerprint is republished only when the version has moved, so an idle room
does not repeat itself.

### 10.1 The algorithm

Must be **byte-identical** in the server, the Go port and the browser client, or
the detector fires on rooms that never drifted.

1. Hash exactly these keys, in this order — no more:
   `activeSceneId, compareSceneId, components, connections, description,
   diagramName, domain, edgeLayouts, flows, iconLibrary, nodeLayouts, scenes`.

   Anything that cannot be synced (ids, `level`, `viewport`) is excluded: it
   would report drift that no resync can fix.

2. Canonicalise each value:
   - `undefined` and `null` → `null`;
   - objects → `{` + entries sorted by key + `}`, dropping `undefined` values,
     each rendered as `"key":value`;
   - arrays → `[` + elements + `]`;
   - everything else → `JSON.stringify` with **no HTML escaping**.

   Key ordering is JavaScript's `<`, i.e. **UTF-16 code units**. This differs
   from UTF-8 byte order above the BMP: a surrogate pair starts at 0xD800 and so
   sorts below U+E000, while its UTF-8 bytes sort above.

3. Join as `key=value` with `;`.

4. Two FNV-1a passes over the **UTF-16 code units** of that string:

   ```
   low  = 0x811c9dc5;  high = 0x01000193
   for each code unit u:
       low  = (low  ^ u) * 0x01000193   (mod 2^32)
       high = (high ^ u) * 0x85ebca6b   (mod 2^32)
   result = hex8(low) + hex8(high)
   ```

5. A null or absent snapshot hashes to sixteen `0`s.

Known-good vectors (from the TypeScript implementation, asserted by the Go
suite):

| snapshot | checksum |
|---|---|
| `null` | `0000000000000000` |
| `{}` | `7caa036145312e87` |
| `{"components":{"a":{"id":"a","name":"A"}}}` | `6ee27865d315b5c3` |
| `{"components":{"a":{"name":"A","id":"a"}}}` | `6ee27865d315b5c3` (key order must not matter) |
| `{"nodeLayouts":{"a":{"elementId":"a","x":10,"y":-2.5}}}` | `5b217967dce8d6e1` |
| `{"diagramName":"coração 🇧🇷 <b>&"}` | `19f19832eb7c19dc` (no HTML escaping, surrogate pairs count as two units) |

### 10.2 What the client must do

The detector is only safe with all three guards. Each has a test that fails when
the guard is removed — a detector that cries wolf under load would be worse than
none.

1. **Nothing in flight.** No pending operations and no queued batch, or the
   client is comparing a state it has not finished sending.
2. **Version must match** the fingerprint's, or the client is merely behind.
3. **At most one repair per 10 seconds**, so a persistent mismatch cannot become
   a storm.

Applying a `SYNC_SNAPSHOT` must also **reset the client's diff baseline**.
Without that, the client answers every repair by broadcasting the view it just
discarded — turning the detector into the storm it exists to prevent.

## 11. Limits and abuse controls

| limit | value | on breach |
|---|---|---|
| participants per room | 15 | `room_full`, socket closed |
| payload size | 100KB | `invalid_json`; size is checked **before** the frame is decoded |
| operations per second, per room+client | 50 (fixed window) | `rate_limited` |
| patches per batch | 10 | `batch_too_large` |
| queued bytes before lossy frames drop | 1MB | frame dropped silently, logged throttled |
| operation log | 1000 ops / 2MB | oldest evicted |

Rate-limit keys are `"<roomId> <clientId>"`. Scoping by room matters: the same
person in two sessions, or a guest-id collision, must not consume another room's
budget or have its own cleared by an unrelated disconnect.

Patch keys `__proto__`, `constructor` and `prototype` are rejected outright.

**Hot-path logging is throttled** to one line per key per second, carrying the
suppressed count. Per-message logging is a synchronous write on every event and
is itself a bottleneck under load.

## 12. Heartbeat

Every 30 seconds the server sends `ping` to every known socket and starts a
10-second timer. A socket that has not answered `pong` when it fires is
terminated without a close handshake.

The client's own `ping` (answered with `pong`) is a separate, client-driven
liveness check and does not affect this timer.

## 13. Known asymmetries and sharp edges

Things a reimplementation should decide about deliberately rather than inherit
by accident:

1. **`host:patch` does not check the sender's role.** `guest:patch` requires
   `role == "guest"`; `host:patch` only requires a socket state, a matching room
   and a live host. A guest socket sending `host:patch` is therefore accepted and
   logged under the guest's `clientId`.
2. **A returning host's `snapshot` is ignored.** On the resumed path the room's
   state wins; the payload is required by the parser and then discarded.
3. **Deep merge stops at one level**, so concurrent edits to different fields of
   the same entity still overwrite each other (§6.2).
4. **A write with no declared `version` bypasses the tombstone check** (§6.3).
   Unreachable today — the protocol gate refuses any client that is not v2, and
   v2 always declares a version — but the path exists.
5. **Checksum repair is all-or-nothing.** A mismatch is fixed with the entire
   snapshot even when a single entity drifted. Safe and rare (zero triggers in a
   healthy session), but a per-collection repair would be cheaper if it ever
   stops being rare.
6. **Rooms are memory-only.** Restarting the relay loses every session; there is
   no room persistence and no cross-instance coordination, so the relay cannot be
   scaled horizontally without sticky routing per room.

## 14. Measured behaviour

Numbers a reimplementation can hold itself to, all from this repository's
harnesses (`scripts/collab-*.mjs`, `server/loadtest/`):

| | value |
|---|---|
| 750 connections (50 rooms x 15) | all connected in 0.3s |
| cursor round trip, p50 | 13ms |
| patch round trip, p50 | 20ms |
| event-loop lag under that load | 4.4ms |
| 1500 connections | p50 holds at 27ms |
| wire, 15 people editing | 5–15 KB/s; median patch 1 entity, ~240 bytes |
| rejoin after a drop, 300 nodes, 5 missed edits | 1.0KB (was 22.4KB as a full snapshot) |
| convergence, 30s with 14 editors | 0 of 13 guests divergent, three consecutive runs, all byte-equal to the server |
| checksum frames | 68 bytes each, ~1KB per 30s, 156–195 per healthy session, 0 resync requests |
| forced drift | repaired 3/3 via the operation counter, 2/2 via the idle path |

## 15. Where the code lives

| | |
|---|---|
| server implementation | `server/src/collab.ts` |
| checksum (server) | `server/src/snapshotChecksum.ts` |
| checksum (browser twin) | `src/features/collaboration/utils/snapshotChecksum.ts` |
| parity test between the twins | `src/features/collaboration/__tests__/snapshotChecksum.parity.test.ts` |
| server tests | `server/src/collab.test.ts` |
| Go port and its tests | `server/go/collab.go`, `server/go/collab_test.go` |
| client hooks | `src/features/collaboration/hooks/useCollab.ts`, `useCollabStoreSync.ts` |
| design history and open items | `docs/collab-entity-patches.md` |
