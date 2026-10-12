# Structura collaboration relay (Go)

The live-collaboration relay for Structura, protocol v3, in Go. It speaks exactly what the
TypeScript relay in [`../server`](../server) speaks — the browser needs nothing different — and
runs in two shapes:

| Mode           | Binary       | Runs on                                        | Rooms in                                                             |
| -------------- | ------------ | ---------------------------------------------- | -------------------------------------------------------------------- |
| **Long-lived** | `cmd/relay`  | ECS, Kubernetes, one host                      | memory (one instance) · Redis (`REDIS_URL`, any number of instances) |
| **Serverless** | `cmd/lambda` | AWS Lambda behind an API Gateway WebSocket API | DynamoDB (default) · Redis (`REDIS_URL`)                             |

Redis is optional in both: without it the long-lived relay keeps rooms in memory and the
serverless one in DynamoDB. Memory is not an option for Lambda, since nothing survives between
invocations. The decision record is [ADR-0012](../docs/adr/0012-go-relay-and-serverless.md).

## Layout

```
cmd/relay         long-lived WebSocket server (/ws, /health, drain on SIGTERM)
cmd/lambda        Lambda handler: $connect, $disconnect, $default, and the scheduled reaper
cmd/apigw-local   a local API Gateway WebSocket API around the Lambda handler
internal/protocol messages and validation (lengths counted in UTF-16, as JavaScript does)
internal/merge    field-level merge — the port of server/src/collab/merge.ts
internal/store    rooms: memory, redis (the TS relay's Lua scripts and layout), dynamo
internal/relay    long-lived session handlers — the port of server/src/collab/relay.ts
internal/serverless  per-invocation session handlers, ordered delivery, reaper
internal/faults   test support: injected Redis and DynamoDB failures, Sweep
deploy/aws        CloudFormation: ECS Fargate service; Lambda + API Gateway + DynamoDB
```

## Run it

```sh
go run ./cmd/relay                                        # ws://localhost:3000/ws, rooms in memory
REDIS_URL=redis://localhost:6379 go run ./cmd/relay       # rooms in Redis

# Serverless, locally: the Lambda handler behind a stand-in API Gateway.
docker run -d -p 8000:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb
DYNAMODB_ENDPOINT=http://localhost:8000 go run ./cmd/apigw-local   # ws://localhost:3000/ws
REDIS_URL=redis://localhost:6379 go run ./cmd/apigw-local          # same, rooms in Redis
```

In the app, open **Live session** and give the `ws://…/ws` URL as the server.

`apigw-local` reproduces what the handler must cope with on AWS: every frame is its own
invocation, run concurrently (`INVOKE_JITTER_MS` delays each at random, so frames of one socket
run out of order); replies go through the real AWS SDK `@connections` client; the 128 KB message
limit, the 10-minute idle timeout and the 2-hour cap apply; `$disconnect` follows a close; the
reaper runs every `REAP_INTERVAL_MS`. With `LAMBDA_URL` it sends the events to the Lambda Runtime
Interface Emulator instead — the real `cmd/lambda` binary in the real Lambda base image:

```sh
docker build -f Dockerfile.lambda -t collab-lambda .
docker run -d -p 9001:8080 -e TABLE_NAME=collab -e CREATE_TABLE=1 \
  -e DYNAMODB_ENDPOINT=http://host.docker.internal:8000 \
  -e CALLBACK_URL=http://host.docker.internal:3000 \
  -e AWS_REGION=us-east-1 -e AWS_ACCESS_KEY_ID=x -e AWS_SECRET_ACCESS_KEY=x collab-lambda
LAMBDA_URL=http://localhost:9001/2015-03-31/functions/function/invocations go run ./cmd/apigw-local
```

## Configuration

| Variable                                          | Mode               | Meaning                                                                                                      |
| ------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `PORT`, `WS_PATH`                                 | relay, apigw-local | listen port (3000), socket path (`/ws`)                                                                      |
| `REDIS_URL`, `REDIS_NAMESPACE`                    | both               | rooms in Redis (`redis://` or `rediss://`), key prefix                                                       |
| `TABLE_NAME`, `DYNAMODB_ENDPOINT`, `CREATE_TABLE` | serverless         | DynamoDB table (`structura-collab`), endpoint override, create when missing                                  |
| `CALLBACK_URL`                                    | serverless         | the `@connections` endpoint, `https://<api>.execute-api.<region>.amazonaws.com/<stage>`; the reaper needs it |
| `COLLAB_HOST_GRACE_MS`                            | both               | how long a dropped host has before the session closes (30000)                                                |
| `COLLAB_MAX_PARTICIPANTS`                         | both               | room capacity (50)                                                                                           |
| `COLLAB_BATCH`                                    | serverless         | `0` sends one message per post instead of JSON-array batches                                                 |
| `SSL_KEY_PATH`, `SSL_CERT_PATH`                   | relay              | serve TLS directly                                                                                           |

## How the serverless mode keeps the protocol's guarantees

A long-lived relay keeps, per socket, its phase, room and the last version it sent, and per room
a subscription that delivers entries in order. In Lambda all of that lives in the store:

- **Connection records** (phase, room, role, held locks, applied patch sequence) and **members**
  (who is in the room, and in which room incarnation). `$connect` writes the record, so a socket
  with no record is one the store forgot — it is closed, and the client rejoins.
- **Ordered, gap-free delivery.** After a commit, an invocation takes the room's _delivery lease_
  and sends every joined socket the entries after the version it was last sent — batched as one
  JSON array per post, under API Gateway's 128 KB — then records the new versions in one write
  (the room's delivery cursor). A socket still joining is skipped until its snapshot is out. An
  invocation that cannot take the lease leaves; the holder re-checks after letting go, so nothing
  committed is left undelivered. A version recorded twice only resends an entry, which clients
  ignore.
- **Per-socket order.** API Gateway may run a socket's frames out of order. A patch waits (up to
  1 s) for the socket's previous one, using the counter at the end of the client's op ids, so a
  drag ends where the user let go.
- **DynamoDB commits in batches.** Every commit is serialised on the room. Patches therefore go
  through a per-room queue: the holder of the room's _write lease_ merges up to 45 queued patches
  in order, commits their entries and removes them from the queue in one transaction, writes each
  touched item once, and answers each sender. A commit is a write-ahead entry: if the writer dies
  before the items are written, the next reader replays it.
- **Timers become checks.** Lock and member expiry are read-time checks. A host's `$disconnect`
  marks it offline; pings and the one-minute reaper close the room once the grace period passes,
  drop sockets whose `$disconnect` was lost (`GetConnection` answers 410), and finish any delivery
  a crashed invocation left.
- **Order of entities.** Collections keep creation order, as JavaScript objects keep keys, so
  every participant lists and stacks elements the same way.

## Tests

```sh
go test -race ./...                                                   # memory only
REDIS_URL=redis://localhost:6379 DYNAMODB_ENDPOINT=http://localhost:8000 go test -race ./...
make cover                    # the same, and fails unless every package is 100% covered
```

Every store runs the same contract, including the merge fixtures exported from the TypeScript
suite (`internal/merge/testdata`, regenerated with `npx tsx scripts/export-merge-fixtures.ts` in
`../server`; a test there fails when they drift). The Lua scripts are the TypeScript relay's, held
identical by a test.

Every statement is covered by its own package's tests (CI runs `make cover`). Error paths are
reached with `internal/faults`: a Redis hook and a DynamoDB middleware that fail chosen calls, and
`faults.Sweep`, which runs an operation once per call it makes with that call failing, so a new
store call is covered — and checked to be reported — without a new test. The relay and serverless
tests wrap their stores the same way.

The black-box suites in the repository run unchanged against either mode:

```sh
# Load and resilience: 500 participants in 35 rooms, a relay killed, Redis restarted, a host lost.
RELAY_BUILD=../../go-server docker compose -f ../deploy/compose/docker-compose.yml up --build -d
(cd ../server && npm run loadtest)
(cd ../server && WS_URL=ws://localhost:3000/ws SCENARIOS=load,host-drop npm run loadtest)   # against apigw-local

# The app in a browser: cursors, follow mode, stress with bots, reconnect chaos.
npm run cy:run:collab -- --spec cypress/e2e/collab-cursors.cy.ts --env COLLAB_WS=ws://localhost:3000/ws
WS_URL=ws://localhost:3000/ws node scripts/collab-reconnect.mjs
```

## Deploy on AWS

See [deploy/aws/README.md](deploy/aws/README.md).

## Limits of the serverless mode

- **Messages over 128 KB.** API Gateway refuses a frame over 128 KB. The relay keeps everything it
  sends under that (snapshot chunks shrink to fit; a catch-up too large falls back to the
  snapshot; an entry too large sends the socket through a fresh join). A _client_ patch over
  128 KB — pasting a very large selection at once — is refused by API Gateway: the socket
  closes, the client reconnects and that unconfirmed edit is dropped. The long-lived relay takes
  up to 256 K characters.
- **Throughput per room.** Measured locally against DynamoDB Local (far slower than DynamoDB):
  150 people in 10 rooms, 20 of them dragging at 10 Hz, fan-out p95 between 100 and 300 ms across runs; at 500 people
  DynamoDB Local saturates (no edit lost — every participant converges once it catches up).
  Lambda with Redis met the full 500-person target (p95 30–40 ms). For rooms with many people
  dragging at once, prefer Redis or the long-lived relay.
- **Cost.** Every frame is an invocation and every recipient a `PostToConnection`. Cursors are
  limited to 15 per second per participant on the server; batching keeps entries to one post per
  socket per delivery round.
- **Connections last at most 2 hours** (API Gateway); the client reconnects and resumes.
