#!/usr/bin/env bash
# Build the relay, run it on a local kind cluster from the manifests in deploy/k8s, and run the
# resilience acceptance against it (a relay pod is deleted mid-load).
#
#   deploy/k8s/kind/run.sh            # create cluster, deploy, test
#   KEEP=1 deploy/k8s/kind/run.sh     # leave the cluster running afterwards
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
cluster="structura-collab"
ns="structura-collab"

if ! kind get clusters | grep -qx "$cluster"; then
  kind create cluster --name "$cluster" --config "$here/kind-config.yaml"
fi
kubectl config use-context "kind-$cluster" >/dev/null

docker build -t structura-collab-relay:latest "$root/server"
kind load docker-image structura-collab-relay:latest --name "$cluster"

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/kind/deploy.yaml
kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s

kubectl apply -k "$root/deploy/k8s"
kubectl -n "$ns" rollout status statefulset/collab-redis --timeout=120s
kubectl -n "$ns" rollout restart deployment/collab-relay
kubectl -n "$ns" rollout status deployment/collab-relay --timeout=180s

for i in $(seq 1 60); do
  curl -fs http://localhost:8081/health >/dev/null && break
  sleep 1
done

cd "$root/server"
WS_URL=ws://localhost:8081/ws \
  SCENARIOS="${SCENARIOS:-kill-relay}" \
  DURATION_MS="${DURATION_MS:-24000}" \
  KILL_RELAY_CMD="kubectl -n $ns delete --wait=false \$(kubectl -n $ns get pod -l app=collab-relay -o name | head -1)" \
  RESTART_REDIS_CMD="kubectl -n $ns delete pod collab-redis-0" \
  npx tsx loadtest/acceptance.ts
status=$?

if [ -z "${KEEP:-}" ]; then kind delete cluster --name "$cluster"; fi
exit $status
