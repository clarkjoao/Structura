# Collaboration protocol v3

> Audience: anyone implementing, extending or debugging a Structura relay or client without
> reading the source. The executable contract is `server/src/collab/protocol.ts` (types and
> guards, shared by both sides) and the merge fixtures in
> `server/src/collab/store/__fixtures__/merge.fixtures.ts`. The OpenSpec change
> `openspec/changes/collab-v3-redis/` holds the requirements this protocol serves.

## 1. Model

- **During a session the relay's store is the source of truth.** The host's workspace is the
  source of truth outside a session: it seeds the room when the session opens, and the host keeps
  applying every entry, so its local diagram always holds the room's latest state.
- **Relays are stateless.** Rooms live behind a `RoomStore`: in memory (single instance, the
  default) or in Redis (`REDIS_URL`, any number of relays). Every relay serves every room.
- **One total order per room.** Each accepted change gets the next room version. Versions are
  gapless, and a change that changes nothing takes no version.
- **Fan-out includes the sender.** Every participant applies the same entries in the same order,
  its own included, so equal versions mean equal state.

One WebSocket path (default `/ws`, `WS_PATH`). Every frame is a JSON text object with a `type`.

## 2. Diagram state and patches

```ts
DiagramState = {
  doc: { diagramId, diagramName, level, domain, description, activeVersionId, compareVersionId },
  entities: { components, connections, flows, iconLibrary, nodeLayouts, edgeLayouts, versions },
}
```

Each collection maps entity id → flat record. A patch changes fields:

```ts
DiagramPatch = {
  doc?:      { <docField>: value },                    // assigned whole
  entities?: { <collection>: { <entityId>: EntityPatch } },
}
EntityPatch = null                                     // remove the entity
            | { set?: { <field>: value }, unset?: [<field>] }
```

`null` *as a field value* is a value. Removing a field is always explicit (`unset`). `diagramId` is
fixed at seed time.

### 2.1 Merge rules (the relay)

| rule | behaviour |
|---|---|
| field merge | `set` fields overwrite one by one; other fields of the entity are untouched. Concurrent edits to different fields both survive. |
| unchanged values | a field set to its current value (same JSON) is dropped; a patch with nothing left takes no version |
| removal wins | removing an entity records the version. A later write composed at an *older* `baseVersion` is dropped. A write at or after it re-creates the entity and clears the record |
| creation | `set` on a missing entity creates it; an `unset`-only patch never creates |
| soft locks | while another participant holds an entity's lock, guarded fields from anyone else are dropped: `nodeLayouts` `x,y,width,height`; `components` `name,description`; `connections` `label,description`. Removal is not guarded |
| effective patch | the relay distributes and logs only what took effect, never the patch as sent |

## 3. Lifecycle

```
host:  create ─► created{hostToken} ─► seed:chunk × N ─► seed:commit ─► joined{version:0}
guest: join ─► joined ─► snapshot:chunk × N ─► snapshot:end        (fresh join)
       join{resumeFrom} ─► joined{catchup:[…]}                      (resume, possibly empty)
       … then entry, entry, …  (only versions above the one it was handed)
```

A client is ready after `joined` with `catchup` (the host's `joined` after a seed carries
`catchup: []`), or after `snapshot:end`. There is no other path.

### 3.1 Host credential

`created.hostToken` is 32 random bytes in base64url. It is returned only to the creator. The
store keeps its SHA-256, compared in constant time. It is required to:

- join as host (`join.hostToken`);
- reseed a room the relay reported as unknown (`create.hostToken`).

Only a socket that joined as host may send `close`.

### 3.2 Host drop and grace

The relay holding the host's socket renews a **host lease** (5 s, renewed every 2 s). When it
lapses, any relay's reaper marks the host offline once and publishes `host:status{online:false}`.
Guests keep editing normally. If the host has not rejoined 30 s after the drop, the room closes
with `session:closed{reason:"host_timeout"}`. `close` from the host closes it at once with
`host_closed`. A closed room answers late joins with `session_closed` for 60 s, then disappears.

### 3.3 Reseed

Only after `error{code:"room_unknown"}` on a host join, the host sends `create` with its existing
`hostToken` and its current diagram. If someone recreated the room first, the answer is
`room_exists`. Timeouts and other errors are retried, never answered with a reseed.

### 3.4 Resume

A client sends `resumeFrom` only when its state provably equals that version: nothing unconfirmed
in flight when the socket dropped. Anything else rejoins fresh. It also sends `resumeEpoch`, the
`joined.epoch` that version belongs to.

The relay replays from its entry log (the last 2,000 entries). It sends the snapshot instead when
either holds:

- the log no longer covers the span;
- the epoch differs: the room was recreated under the same id after a storage loss.

### 3.5 Storage loss

Every relay checks the rooms it serves every 2 s. A room that is gone from the store, or that now
has a different epoch, has its sockets closed with code `4004` (`room_lost`). Clients reconnect:

- the host gets `room_unknown` and reseeds (§3.3);
- a guest that was already in the session keeps retrying `room_unknown` for up to the grace
  period, until the host has brought the room back.

## 4. Messages

### 4.1 Client → relay

| type | fields | notes |
|---|---|---|
| `create` | `protocol`, `roomId`, `user`, `seedChars`, `seedChunks`, `hostToken?` | `seedChunks` must equal `ceil(seedChars / 65536)` (min 1). `hostToken` only for a reseed |
| `seed:chunk` | `index`, `data` | up to 65,536 chars each |
| `seed:commit` | — | parses and validates the seed; opens the room at version 0 |
| `join` | `protocol`, `roomId`, `user`, `hostToken?`, `resumeFrom?`, `resumeEpoch?` | `resumeEpoch` must match the room's epoch for a replay |
| `patch` | `opId`, `baseVersion`, `patch` | `baseVersion`: last version applied when composing |
| `lock` | `action` (`acquire`/`renew`/`release`), `entityId` | TTL 3 s; holders renew every second |
| `cursor` | `cursor` (`{x,y}` or `null`), `activeElementId` | `null` cursor = left the canvas |
| `close` | — | host only; ends the session for everyone |
| `ping` / `pong` | — | application-level liveness; the relay also pings at the transport level every 30 s |

`user` is `{id, name, color}`. `id` is the participant's `clientId` and must be stable across that
participant's reconnects.

### 4.2 Relay → client

| type | fields | sent to |
|---|---|---|
| `created` | `roomId`, `clientId`, `hostToken` | the creating host |
| `joined` | `clientId`, `role`, `version`, `participants`, `maxParticipants`, `hostOnline`, `epoch`, `catchup?` | the joiner |
| `snapshot:chunk` | `index`, `total`, `data` | the joiner (no `catchup`) |
| `snapshot:end` | `version` | the joiner |
| `entry` | `version`, `opId`, `sender`, `patch` | everyone in the room, sender included, in version order |
| `ack` | `opId`, `applied`, `version` | the sender. `applied:false` → nothing took effect; drop the pending op. It may arrive before or after the matching `entry` |
| `lock:result` | `entityId`, `granted`, `holder` | the requester (acquire, or a refused renew) |
| `lock` | `entityId`, `holder` (`null` = released), `ttlMs` | everyone (lossless) |
| `cursors` | `entries[]` (`clientId`, `cursor`, `activeElementId`) | everyone, coalesced every 50 ms per relay; includes your own entry — skip it by `clientId`. Lossy |
| `peer:joined` | `participant`, `participantCount` | everyone except the joiner |
| `peer:left` | `clientId`, `participantCount` | everyone |
| `host:status` | `online` | everyone |
| `session:closed` | `reason` (`host_closed`/`host_timeout`) | everyone; the socket then closes |
| `error` | `code`, `message`, `limit?`, `size?` | the offender |
| `ping` / `pong` | — | |

### 4.3 Error codes

| code | closes | meaning |
|---|---|---|
| `invalid_message` | no | unparseable, unknown type, or failed validation (incl. `__proto__`/`constructor`/`prototype` keys anywhere) |
| `protocol_mismatch` | **yes** (1008) | not protocol 3 |
| `not_joined` / `already_joined` | no | message out of phase |
| `unauthorized` | no | bad host credential, or `close` from a non-host |
| `room_unknown` | no | no such room (the only trigger for a reseed) |
| `room_exists` | no | `create` for an id in use |
| `not_ready` | no | the room is still seeding; retry shortly |
| `room_full` | **yes** (1008) | capacity reached (`limit`) |
| `session_closed` | no | the session ended |
| `too_large` | no | frame over 256K chars, or seed over 8M chars (`size`, `limit`) |
| `invalid_seed` | no | seed incomplete or not a valid `DiagramState`; the room is discarded |
| `rate_limited` | no | over the per-participant budget; the patch is acked `applied:false` |
| `unavailable` | no | transient store failure; retry |

## 5. Limits

| limit | value |
|---|---|
| participants per room | 50 (`maxParticipants`) |
| frame | 256K chars |
| seed / snapshot chunk | 64K chars |
| seed | 8M chars |
| edits per participant | 30/s sustained, burst 60 |
| cursor updates | 20/s |
| lock requests | 10/s, burst 20 |
| lossy frames dropped above | 1 MB queued for that socket |
| socket closed above | 8 MB queued (the client reconnects and resumes) |
| entry log | 2,000 entries per room |

## 6. Clients

- Drags are throttled at the source to about 10 updates per second, and the final position is
  always sent.
- Inbound entries are applied as they arrive, never deferred to an animation frame, so a
  background tab stays current.
- Local changes not yet confirmed are kept as a pending overlay. They are rebased onto each
  incoming entry, and dropped when their own entry or an `applied:false` ack arrives.
- Remote entries never enter the local undo history.
