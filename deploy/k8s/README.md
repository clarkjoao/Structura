# Collaboration relay on Kubernetes

Manifests for running the live-collaboration relay (`server/`) with several replicas behind an
ingress. The relay pods are stateless: rooms live in Redis, so any pod serves any room, and pods
can be added, removed or killed without session affinity.

```
kubectl apply -k deploy/k8s
```

| file             | what                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `namespace.yaml` | `structura-collab` namespace                                                             |
| `redis.yaml`     | Redis 7 StatefulSet (1 replica) + Service — shared room state                            |
| `relay.yaml`     | relay Deployment (3 replicas), Service, HPA (2–10 on CPU), PodDisruptionBudget           |
| `ingress.yaml`   | ingress-nginx route for `/ws` and `/health`, long WebSocket timeouts, no affinity        |
| `kind/`          | local cluster config and `run.sh`, which deploys these manifests and runs the acceptance |

The image is built from `server/Dockerfile` (`structura-collab-relay:latest` in the manifest;
point it at your registry).

## Configuration

| env (relay)               | default |                                                                   |
| ------------------------- | ------- | ----------------------------------------------------------------- |
| `REDIS_URL`               | —       | shared store; without it the relay runs single-instance in memory |
| `REDIS_NAMESPACE`         | empty   | key prefix, so several deployments can share one Redis            |
| `COLLAB_HOST_GRACE_MS`    | `30000` | how long a dropped host has before its session closes             |
| `COLLAB_MAX_PARTICIPANTS` | `50`    | per room                                                          |
| `WS_PATH`                 | `/ws`   |                                                                   |

Clients reach the relay at `wss://<host>/ws`; the app's start-session dialog takes that URL.

## Sizing

Measured with `server/loadtest/acceptance.ts` (500 participants in 35 rooms, three rooms of 50
with 20 people dragging at 10 Hz): fan-out p95 under 70 ms on a local kind cluster with three
pods, every participant converged, and a deleted pod's participants back within a second.
One Redis instance handles this with a wide margin; each accepted edit is one short Lua call.

## Redis availability

Redis is the only stateful piece. Two levels:

- **Default (no persistence).** If Redis restarts, rooms are gone; relays notice within two
  seconds, every client reconnects, and each **host reseeds its room from its own copy** — the
  protocol recovers on its own, losing at most edits that were in flight.
- **Persistence.** Set `--appendonly yes` in `redis.yaml` and give the StatefulSet a volume at
  `/data` (a `volumeClaimTemplates` entry), or point `REDIS_URL` at a managed Redis or a
  Sentinel-managed deployment. Rooms then survive a Redis restart outright.

Redis Cluster is not supported: the scripts and the fan-out reader assume one keyspace.

## Local run (kind)

```
deploy/k8s/kind/run.sh                    # kill-relay scenario
SCENARIOS=load,kill-relay,redis-restart deploy/k8s/kind/run.sh
KEEP=1 deploy/k8s/kind/run.sh             # keep the cluster afterwards
```

It creates a kind cluster with ingress-nginx on `localhost:8081`, loads the relay image, applies
these manifests, and runs the acceptance with pod deletion standing in for a pod crash.
