# Tasks

## 1. M1 — Protocol v3 and the in-memory relay

- [x] 1.1 Create branch `feat/collab-v3` from `main`; scaffold `server/src/collab/` (protocol, session, store, transport) and verify `cd server && npx tsc --noEmit` passes on the empty modules
- [x] 1.2 Define the v3 message types with type guards in a module shared by server and client (join/room:created/seed:_/snapshot:_/patch/entry/ack/lock:*/presence/host:close/error codes incl. `room_unknown`, `not_ready`, `unauthorized`, `too_large`) and verify guard unit tests reject malformed frames and prototype-polluting keys
- [x] 1.3 Define the `RoomStore` interface (design D1) and implement `MemoryRoomStore`: field merge, tombstone rule, version + ordered op log with resume, chunked seed (begin/chunk/commit, `seeding` status), consistent snapshot read; verify with a shared fixture suite of ≥40 patch→expected-state cases (`server/src/collab/store/__fixtures__`)
- [x] 1.4 Implement session handlers over `RoomStore`: create with `hostToken` (SHA-256 stored, constant-time compare), join/capacity 50, resume from version (empty catch-up included), host:close, reseed only on unknown room, v2 refusal; verify server tests covering every collab-session and collab-sync scenario that does not need multiple instances
- [x] 1.5 Implement host lease + reaper (D6) on the memory store with an injectable clock; verify tests for host reconnect within grace, close after 30 s, and intentional close
- [x] 1.6 Implement per-connection token-bucket rate limits, frame caps and outbound backpressure (D13); verify tests for flood isolation and lossy-frame dropping
- [x] 1.7 Wire the new relay into `server/src/index.ts`, delete `server/src/collab.ts`, `server/src/snapshotChecksum.ts` and their tests; verify `cd server && npm test` and `npm run build` pass
- [x] 1.8 Write `docs/collab-protocol-v3.md` (messages, errors, merge, resume, chunking, lease) and verify every message type in the guards module is documented

## 2. M2 — Redis adapter

- [x] 2.1 Add `ioredis` to `server/`, a `REDIS_URL` config switch and a Redis service in a dev compose file; verify the relay boots in both modes and `/health` reports the adapter
- [x] 2.2 Write `apply.lua`, `seed-commit.lua`, `snapshot.lua` and `close.lua` per D2/D3/D5/D6 with `{roomId}` hash tags; verify the shared fixture suite from 1.3 passes against `RedisRoomStore`
- [x] 2.3 Implement Stream fan-out (per-pod `XREAD BLOCK` loop with last-id tracking, resume after Redis reconnect) and pub/sub presence; verify a test with two relay processes on one Redis where clients on different processes converge
- [x] 2.4 Implement locks in Redis (`SET NX PX`, renew, release) and lock enforcement inside `apply.lua`; verify tests that a non-holder's guarded fields are dropped and a lock expires after holder loss
- [x] 2.5 Implement the lease sorted set + reaper on Redis with single-winner close; verify a two-process test where exactly one close event is emitted
- [x] 2.6 Run the full server suite against both adapters in CI (Redis service container) and verify the workflow is green

## 3. M3 — Client sync rewrite

- [x] 3.1 Create `src/features/collaboration/sync/CollabClient.ts` (state machine per D9, no React) with a fake socket; verify unit tests for every transition, including empty catch-up → ready
- [x] 3.2 Implement the per-field diff and the pure rebase function `(confirmed, pending, entry) → (confirmed', pending')`; verify exhaustive unit tests (concurrent drag, delete under pending edit, lock-denial revert, own-entry confirmation)
- [x] 3.3 Implement `StoreBridge`: timer-based send loop with 100 ms drag coalescing and final-position flush, inbound apply from `onmessage` through a store action that skips `pushHistory` and preserves unsynchronised fields (`folderId`, `viewport`, `createdAt`); verify tests that a snapshot keeps the folder and undo only reverts local edits
- [x] 3.4 Implement host flows: chunked seed with local size check, `hostToken` in `sessionStorage`, reseed only on `room_unknown`, `close` on end-session only (a closed tab ends through the grace period so a reload can resume); verify unit tests with the fake socket
- [x] 3.5 Rewire `CollabProvider`, `CollabRoom` and modals to the new client; keep the canvas mounted during host reconnect (D10) with an overlay; delete `hooks/useCollab.ts`, `hooks/useCollabStoreSync.ts`, `utils/snapshotChecksum.ts` and their tests; verify `npm run typecheck`, `npm run lint` and `npm test` pass
- [x] 3.6 Reproduce the React Flow "Maximum update depth exceeded" remount loop in isolation, fix its root cause, and verify with a regression test that remounting the canvas with a populated store does not throw — outcome: the loop does not reproduce on the current base with the v3 client (full guest canvas remounts, three in a row, no error; the original crash was on the v2 client over an older canvas). D10 keeps the canvas mounted anyway, and the reconnect harness (3.8) fails on any page error during host and guest drops
- [x] 3.7 Add en and pt-BR strings for every new session message (not ready, room full, host reconnecting, session ended, too large, unauthorized, update required); verify the i18n key-parity check passes
- [x] 3.8 Recreate `scripts/collab-reconnect.mjs` for v3 (guest drop, host drop, drop mid-drag, chaos mode over multiple relays) and verify zero divergent clients and no stuck "Syncing…" in 10 chaos cycles against the dev compose stack
- [x] 3.9 Verify the background-tab scenario: a Playwright test hides the host page while guests edit for 60 s and asserts the host has every edit when visible

## 4. M4 — Large diagrams

- [x] 4.1 Implement chunked snapshot delivery to joiners (`snapshot:chunk` / `snapshot:end` followed by live entries) on both adapters; verify a server test that a join during concurrent edits ends exactly at the room version
- [x] 4.2 Add a 1,000-node fixture generator and measure seed + join; verify the join completes in < 3 s locally and the seed commit stays under 20 ms of Redis time (batch the commit if not, per Risks)
- [x] 4.3 Show the "too large (X MB / limit Y MB)" message from the client's local size check and from the server's `too_large`; verify a component test and en/pt-BR strings

## 5. M5 — Presence and soft locks

- [x] 5.1 Implement client lock acquire/renew/release around drag and text-edit gestures, pre-emptive block from presence, and optimistic revert on denial; verify unit tests and a two-browser Playwright test where B cannot drag A's held node
- [x] 5.2 Extend `usePeerOnNode`, `CollabPeerPresence` and `CollabEdgeHighlight` to show lock holders and who-is-editing; verify component tests and en/pt-BR strings
- [x] 5.3 Rebuild cursor coalescing (50 ms per room, own cursor filtered, null on canvas leave) on the new transport; verify server and client tests

## 6. M6 — Acceptance, deployment and cleanup

- [x] 6.1 Build `deploy/compose/` (3 relays, Redis, HAProxy round-robin) and rework `server/loadtest/` for v3; verify the load run reports 500 connections / 35 rooms / 3×50 with 20 dragging at 10 Hz, p95 < 150 ms, 0 divergent clients
- [x] 6.2 Add resilience scenarios to the harness: kill a relay (editing again ≤ 5 s, no confirmed edit lost), restart Redis without persistence (host reseeds, no empty state served), host drop (room keeps working, closes at 30 s); verify each scenario asserts and reports its measurement
- [x] 6.3 Add a CI job running the compose acceptance suite on every PR; verify it fails when a target is deliberately broken (e.g. grace set to 1 s) and passes on the real config
- [x] 6.4 Write `deploy/k8s/` (Deployment, HPA, PDB, Service, ingress-nginx Ingress with WebSocket timeouts, Redis StatefulSet with optional AOF) and `deploy/k8s/README.md`; verify the relay-kill scenario passes on a kind cluster built from them (manual workflow)
- [x] 6.5 Delete `server/go/`, `docs/collab-websocket-protocol.md`, `docs/collab-entity-patches.md`, `docs/collab-architecture-study.md`; rewrite `docs/concepts/collaboration.md`; add an ADR for server authority on Redis; verify no remaining references with `grep -rn "server/go\|collab-websocket-protocol\|Yjs" docs src server AGENTS.md`
- [x] 6.6 Final gate: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `cd server && npm test`, compose acceptance suite — all green; open the single PR
