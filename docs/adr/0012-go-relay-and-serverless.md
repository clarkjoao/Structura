# ADR-0012 — A Go relay, long-lived or serverless, with Redis optional

**Status:** Accepted

## Context

The v3 relay (ADR-0011) runs as a long-lived Node process: one instance with rooms in memory, or
several sharing Redis. Structura also needs to run it on AWS as ECS tasks, and as Lambda
functions behind an API Gateway WebSocket API — with no Redis to operate when the deployment is
small.

Lambda breaks the relay's working assumptions. Nothing survives between invocations; every frame
is its own invocation, and frames of one socket can run concurrently, out of order; replies go out
through the `@connections` API, with a 128 KB message limit; there are no timers. The relay keeps
socket phases, room subscriptions, per-socket delivered versions, lock and host timers in memory.

## Decision

1. **A Go relay in `go-server/`, wire-compatible with the TypeScript one.** Same protocol, same
   merge (held to the same fixtures, exported from the TS suite), same Redis layout and Lua
   scripts — both relays can share one Redis during a migration. The TS relay stays the
   reference until the Go one has run in production.
2. **Two entry points over one core.** `cmd/relay` is the long-lived relay (memory or Redis).
   `cmd/lambda` runs per-invocation handlers (DynamoDB or Redis). Redis is optional in both.
3. **In Lambda, session state lives in the store.** A connection record per socket, written at
   `$connect` (a socket without one was forgotten by the store, and is sent back through a fresh
   join); membership per room; a delivery cursor per room.
4. **Ordered, gap-free delivery through a per-room lease.** After a commit, an invocation takes
   the room's delivery lease and sends every joined socket the entries after what it was last
   sent; the holder re-checks after releasing, so no committed entry is stranded. Joining sockets
   are skipped until their snapshot is out. No client change was needed for ordering.
5. **DynamoDB commits through a queue in batches.** One commit per round trip serialises a room;
   a write-lease holder applies up to 45 queued patches per transaction, with write-ahead entries
   so a crash between commit and item writes loses nothing.
6. **Frames may batch messages as a JSON array.** One post per socket per delivery round. The
   client reads arrays; a relay that never sends one is unaffected.

## Consequences

- A local stand-in for API Gateway (`cmd/apigw-local`) runs the handler with concurrent,
  jittered invocations — or the real binary in the Lambda base image — so the load harness, the
  Cypress specs and the browser reconnect script run against serverless mode unchanged.
- Serverless rooms are bounded by the store: Redis met the full 500-person target in Lambda mode;
  DynamoDB suits smaller rooms (see `go-server/README.md` for the measurements).
- A client patch over 128 KB cannot pass API Gateway. The long-lived relay has no such limit.
