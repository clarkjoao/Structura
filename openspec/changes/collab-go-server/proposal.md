## Why

The v3 relay (`server/`, TypeScript) runs as a long-lived process: on Kubernetes or a single
instance, with Redis optional. Structura also needs to run the relay on AWS in two shapes:

- **ECS** (Fargate or EC2): long-lived containers behind a load balancer, like Kubernetes.
- **Lambda + API Gateway WebSocket API**: no long-lived process. API Gateway holds the sockets,
  every frame is a separate Lambda invocation, and replies go out through the `@connections`
  management API.

The second shape cannot run the current relay: it keeps sockets, subscriptions, timers and
per-socket order in process memory. A Go relay gives one small static binary for both shapes,
fast cold starts on Lambda, and one codebase for the server side.

## What Changes

- New Go module `go-server/` that speaks collaboration protocol v3 unchanged. The browser client
  needs no change for the long-lived mode.
- **Long-lived mode** (`cmd/relay`): a WebSocket server for ECS, Kubernetes or a single host.
  Rooms live in memory (single instance) or in Redis (`REDIS_URL`, any number of instances).
  The Redis layout and Lua scripts are the TypeScript relay's, so both relays can share one
  Redis during a migration.
- **Serverless mode** (`cmd/lambda`): a Lambda handler for the API Gateway WebSocket API
  (`$connect`, `$disconnect`, `$default`) plus a scheduled reaper. Rooms live in DynamoDB
  (default) or Redis. Memory is not an option there, since nothing survives between invocations.
- **Ordered delivery without a process:** in serverless mode a per-room delivery lease makes one
  invocation at a time push entries to every socket of the room, from each socket's own delivered
  version, so entries arrive in order and without gaps however invocations interleave.
- **Batched frames (additive):** in serverless mode one frame may carry a JSON array of server
  messages, so a delivery round costs one `PostToConnection` per socket. The client learns to
  read arrays; a v3 relay that never sends one is unaffected.
- **Shared merge fixtures:** the merge fixtures move to JSON exported from the TypeScript suite;
  the Go stores run the same cases.
- A local API Gateway emulator (`cmd/apigw-local`) runs the Lambda handler behind a real
  WebSocket, with concurrent invocations per socket, so the existing acceptance harness and the
  Cypress collaboration specs run against serverless mode on a laptop.
- AWS deployment templates: an ECS service and the Lambda + API Gateway + DynamoDB stack.

## Non-Goals

- Removing the TypeScript relay. It stays the reference implementation until the Go relay has
  run in production.
- Changing the protocol semantics, limits or merge rules.
- Serverless-mode parity with the long-lived load target (500 people, 20 dragging at 10 Hz in one
  room). DynamoDB serialises a room's writes; the serverless mode targets smaller rooms and is
  documented with its measured limits.
- Multi-region or global tables.
