## 1. Core

- [x] 1.1 Go module, protocol types and validation with UTF-16 limits; tests mirroring `protocol.test.ts`
- [x] 1.2 Merge fixtures exported to JSON from the TS suite, with a TS test that keeps them current; Go merge passing every fixture
- [x] 1.3 RoomStore interface, memory store and Redis store (Lua shared with the TS relay); contract tests for both

## 2. Long-lived relay

- [x] 2.1 Port `relay.ts` (create/seed, join/resume, patches, locks, cursors, host lease, reaper, room check, backpressure, drain); tests mirroring `relay.test.ts`
- [x] 2.2 `cmd/relay` with `/health`, graceful drain, Dockerfile; the acceptance harness and the Cypress collaboration specs pass against it, alone and three instances on Redis

## 3. Serverless

- [x] 3.1 DynamoDB store (write-ahead entries, conditional materialisation, TTL) passing the contract tests against DynamoDB Local
- [x] 3.2 Connection records, delivery pump, presence fan-out, reaper; Redis variants
- [x] 3.3 Client reads batched frames
- [x] 3.4 `cmd/lambda` and `cmd/apigw-local`; the Cypress collaboration specs and an acceptance run pass against the emulator on DynamoDB Local and on Redis

## 4. Deployment

- [x] 4.1 AWS templates: ECS service; Lambda + API Gateway WebSocket + DynamoDB + reaper schedule
- [x] 4.2 Docs: `go-server/README.md`, `docs/concepts/collaboration.md`, ADR for the Go relay and serverless mode

## 5. Found while testing

- [x] 5.1 Keep entity creation order in every store (JS key order), after the browser reconnect script caught the Go snapshot sorting ids
- [x] 5.2 Batch DynamoDB commits through a per-room queue, after 20 people dragging collapsed patch-by-patch commits
- [x] 5.3 Refuse a patch whose apply failed (ack `applied: false`), so a client never waits on an answer that never comes
- [x] 5.4 Write the connection record at `$connect` and close sockets the store forgot, after a Redis restart left idle guests on a dead room
- [x] 5.5 Load-harness participants ping like the browser client (15 s)

## 6. Coverage

- [x] 6.1 Every Go package 100% covered by its own tests, gated in CI (`make cover`); store, registry and API Gateway failures injected with `internal/faults` and swept call by call
