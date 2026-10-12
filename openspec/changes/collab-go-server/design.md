## Context

The v3 relay is described in `openspec/changes/collab-v3-redis/` and ADR-0011. Its session
handlers keep every piece of room state in a `RoomStore`, which makes a port that changes the
transport possible without changing the protocol.

## Decisions

### D1. One module, two entry points, shared core

```
go-server/
  cmd/relay        long-lived WebSocket server (ECS, Kubernetes, single host)
  cmd/lambda       API Gateway WebSocket handler + scheduled reaper
  cmd/apigw-local  local API Gateway emulator around the Lambda handler
  internal/protocol  messages, validation, limits, UTF-16 helpers
  internal/merge     field-level merge (the reference: server/src/collab/merge.ts)
  internal/store     RoomStore: memory, redis (Lua shared with the TS relay), dynamo
  internal/relay     long-lived session handlers (port of relay.ts)
  internal/serverless  per-invocation session handlers, delivery pump, reaper
```

### D2. Wire compatibility is byte-level where JavaScript is

- Frame and chunk limits are counted in UTF-16 code units, like `string.length`.
- Seed chunks are cut by the browser at arbitrary UTF-16 offsets, so a chunk may end in half a
  surrogate pair. Chunk text is decoded to UTF-16 units, joined, and only then turned into UTF-8.
- Snapshot chunks are cut at UTF-16 offsets that never split a pair.
- Values are kept as raw JSON; "unchanged" compares their compact encoding, as `encodeValue`
  does.

### D3. Serverless state

Per-socket state (phase, room, client id, role, held locks, applied patch sequence) is a
connection record, written at `$connect`: a socket with no record is one the store forgot (Redis
restarted), and is closed so its client rejoins. Membership is a member item per socket in the
room's partition; what each socket was sent is one delivery-cursor item per room (one write per
delivery round).

DynamoDB, one table, `pk`/`sk`:

| item                                               | pk                 | sk                                       |
| -------------------------------------------------- | ------------------ | ---------------------------------------- |
| room meta (status, version, applied, epoch, host…) | `r#<room>`         | `meta`                                   |
| doc fields                                         | `s#<room>#<epoch>` | `doc`                                    |
| entity, or its tombstone (`del`)                   | `s#<room>#<epoch>` | `e#<collection>#<id>`                    |
| entry (effective patch)                            | `s#<room>#<epoch>` | `v#<version, 12 digits>`                 |
| queued patch                                       | `s#<room>#<epoch>` | `q#<sequence>`                           |
| lock                                               | `s#<room>#<epoch>` | `l#<entity>`                             |
| seed chunk                                         | `s#<room>#<epoch>` | `c#<index>`                              |
| connection                                         | `c#<connection>`   | `conn`                                   |
| member, delivery cursor, leases, host offline      | `m#<room>`         | `k#<connection>`, `cur`, `lease`, `host` |
| open-room index (reaper)                           | `rooms`            | `r#<room>`                               |

State lives under the room's epoch, so a recreated room never sees the old one's items.

A commit is a write-ahead entry: one transaction moves `version` from V to V+k (only while
`applied` = V), puts the k entries and removes the k queued patches. Each touched item is then
written once, as it stands after the batch, conditioned on its own `v` being older, so a slow
writer never overwrites a newer value; then `applied` advances. A reader that finds `applied` <
`version` materialises the missing entries first, in order; a snapshot replays the entries that
land while it reads, per item.

Patches reach DynamoDB through that queue: each invocation enqueues its patch, and the holder of
the room's write lease applies up to 45 per transaction and answers every sender. Committing
patch by patch serialised a room at one round trip per edit and collapsed under 20 people
dragging; batching removed the ceiling at the same load.

Entities keep creation order (an `o` attribute: seed position, then version and position in the
patch), as JavaScript objects keep keys, so every participant lists and stacks them the same way.

### D4. Ordered delivery in serverless mode

After any commit, the invocation tries to take the room's delivery lease (a conditional write
with a short expiry). The holder loops: read the room version, and for every joined socket whose
delivered version is behind, post the missing entries in order (batched, under the API Gateway
size limit) and record the new delivered versions in one write; stop when nothing is behind;
release; re-check, and go again while anything is behind and nobody else holds the lease. A
joining socket is skipped until its snapshot (or catch-up) is out and it records its own
delivered version, so no entry reaches a socket before its snapshot. A recorded version that goes
backwards only resends entries, which clients ignore. A socket that answers 410 Gone is removed;
one that cannot be served from the log (or whose entry exceeds 128 KB) is closed and rejoins.
Pings re-run the pump, so a crashed lease holder delays delivery by at most the lease expiry.

API Gateway may also run one socket's patches out of order. A patch waits (up to 1 s) for the
socket's previous one, using the counter that ends the client's op ids.

### D5. Timers become lazy checks plus a reaper

Lock expiry and member expiry are checked on read. `$disconnect` frees the socket's locks and
membership and, for a host, marks the host offline. A scheduled reaper (EventBridge, every
minute) and every invocation in the room close a room whose host has been offline past the grace
period. Cursor coalescing becomes a per-socket rate limit.

### D6. Serverless limits

- API Gateway frames: 32 KB per frame, 128 KB per message. Snapshot chunks use 32 K chars; a
  `joined` whose catch-up would exceed the limit falls back to the snapshot.
- Connections last at most 2 h and idle out after 10 min; the client's 10 s ping and its
  reconnect cover both.

## Risks

- DynamoDB throughput is bounded by the table: measured on DynamoDB Local (slower than the real
  service), 150 people with 20 dragging at 10 Hz held p95 100–300 ms across runs; 500 people saturated it, with
  every participant converging once it caught up. Lambda with Redis met the full target.
- `PostToConnection` cost grows with room size times edit rate; batching bounds it to one call
  per socket per delivery round.
- A client patch over 128 KB cannot pass API Gateway.
