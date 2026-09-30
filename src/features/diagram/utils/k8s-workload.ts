import type {
  Component,
  K8sClusterComponent,
  K8sWorkloadComponent,
  K8sWorkloadKind,
} from "../model/component.types";
import { isK8sClusterComponent } from "../model/component.guards";

/*
 * What a workload shows of its pods, derived from its data — the pods are a
 * representation, never nodes. A DaemonSet runs one per node, so its count
 * comes from the cluster it sits in.
 */

export const DEFAULT_WORKLOAD_KIND: K8sWorkloadKind = "Deployment";
/** Nodes assumed for a DaemonSet whose cluster does not say. */
export const DEFAULT_CLUSTER_NODES = 3;
/** Zones a Deployment's pods are labelled with when none are given. */
export const DEFAULT_ZONES: readonly string[] = ["1a", "1b", "1c"];
/** Tiles drawn before the rest are summed up as "+N". */
export const MAX_REPLICA_TILES = 6;

export function workloadKind(workload: K8sWorkloadComponent): K8sWorkloadKind {
  return workload.kind ?? DEFAULT_WORKLOAD_KIND;
}

/** The nearest cluster around `id`, if any. */
export function clusterOf(
  id: string,
  components: Record<string, Component>,
): K8sClusterComponent | undefined {
  let current = components[id]?.parentId ?? null;
  const seen = new Set<string>([id]);
  while (current && !seen.has(current)) {
    seen.add(current);
    const component = components[current];
    if (component && isK8sClusterComponent(component)) return component;
    current = component?.parentId ?? null;
  }
  return undefined;
}

function whole(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

/** How many pods the workload runs. */
export function replicaCount(
  workload: K8sWorkloadComponent,
  components: Record<string, Component>,
): number {
  switch (workloadKind(workload)) {
    case "Pod":
      return 1;
    case "DaemonSet":
      return whole(clusterOf(workload.id, components)?.nodeCount, DEFAULT_CLUSTER_NODES);
    default:
      return whole(workload.replicas, 1);
  }
}

/** Replicas drawn as a stack of cards behind the workload: more than one, and not a bare pod. */
export function isStacked(
  workload: K8sWorkloadComponent,
  components: Record<string, Component>,
): boolean {
  return workloadKind(workload) !== "Pod" && replicaCount(workload, components) > 1;
}

export interface ReplicaTile {
  label: string;
  /** A StatefulSet pod's claim: "pvc-0". */
  volume?: string;
}

/**
 * The tiles a workload draws, by kind: zone-labelled pods for a Deployment,
 * ordinal pods with their claims for a StatefulSet, one per node for a
 * DaemonSet, none for jobs and bare pods. At most `MAX_REPLICA_TILES`; the
 * caller says the rest as "+N".
 */
export function replicaTiles(
  workload: K8sWorkloadComponent,
  components: Record<string, Component>,
): { tiles: ReplicaTile[]; more: number } {
  const kind = workloadKind(workload);
  const count = replicaCount(workload, components);
  const shown = Math.min(count, MAX_REPLICA_TILES);
  const more = count - shown;
  const range = Array.from({ length: shown }, (_, i) => i);
  switch (kind) {
    case "Deployment": {
      const zones = workload.zones && workload.zones.length > 0 ? workload.zones : DEFAULT_ZONES;
      return { tiles: range.map((i) => ({ label: zones[i % zones.length] })), more };
    }
    case "StatefulSet":
      return {
        tiles: range.map((i) => ({ label: `${workload.name}-${i}`, volume: `pvc-${i}` })),
        more,
      };
    case "DaemonSet":
      return { tiles: range.map((i) => ({ label: `n${i + 1}` })), more };
    default:
      return { tiles: [], more: 0 };
  }
}
