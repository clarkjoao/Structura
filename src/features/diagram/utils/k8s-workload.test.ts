import { describe, expect, it } from "vitest";
import type { Component, K8sWorkloadComponent } from "../model/component.types";
import { clusterOf, isStacked, replicaCount, replicaTiles } from "./k8s-workload";

const wl = (extra: Partial<K8sWorkloadComponent> = {}): K8sWorkloadComponent =>
  ({
    id: "wl",
    name: "api",
    description: "",
    parentId: "ns",
    type: "k8s-workload",
    ...extra,
  }) as K8sWorkloadComponent;

function tree(workload: K8sWorkloadComponent, nodeCount?: number): Record<string, Component> {
  return {
    cluster: {
      id: "cluster",
      name: "prod",
      description: "",
      parentId: null,
      type: "k8s-cluster",
      ...(nodeCount !== undefined ? { nodeCount } : {}),
    } as Component,
    ns: {
      id: "ns",
      name: "shop",
      description: "",
      parentId: "cluster",
      type: "k8s-namespace",
    } as Component,
    wl: workload,
  };
}

describe("replicaCount", () => {
  it("is the replicas for a Deployment, 1 when unset", () => {
    expect(replicaCount(wl({ replicas: 3 }), tree(wl()))).toBe(3);
    expect(replicaCount(wl(), tree(wl()))).toBe(1);
  });

  it("is always 1 for a bare Pod", () => {
    expect(replicaCount(wl({ kind: "Pod", replicas: 5 }), tree(wl()))).toBe(1);
  });

  it("is the cluster's nodes for a DaemonSet, 3 when it does not say", () => {
    const ds = wl({ kind: "DaemonSet", replicas: 9 });
    expect(replicaCount(ds, tree(ds, 5))).toBe(5);
    expect(replicaCount(ds, tree(ds))).toBe(3);
  });

  it("reads a negative or fractional count sensibly", () => {
    expect(replicaCount(wl({ replicas: -2 }), tree(wl()))).toBe(1);
    expect(replicaCount(wl({ replicas: 2.8 }), tree(wl()))).toBe(2);
  });
});

describe("isStacked", () => {
  it("stacks more than one replica, never a bare pod", () => {
    expect(isStacked(wl({ replicas: 2 }), tree(wl()))).toBe(true);
    expect(isStacked(wl({ replicas: 1 }), tree(wl()))).toBe(false);
    expect(isStacked(wl({ kind: "Pod", replicas: 4 }), tree(wl()))).toBe(false);
  });
});

describe("replicaTiles", () => {
  it("labels a Deployment's pods with their zones, cycling", () => {
    const d = wl({ replicas: 3, zones: ["1a", "1b"] });
    expect(replicaTiles(d, tree(d)).tiles.map((t) => t.label)).toEqual(["1a", "1b", "1a"]);
  });

  it("gives a StatefulSet ordinal pods and their claims", () => {
    const s = wl({ kind: "StatefulSet", replicas: 2 });
    expect(replicaTiles(s, tree(s)).tiles).toEqual([
      { label: "api-0", volume: "pvc-0" },
      { label: "api-1", volume: "pvc-1" },
    ]);
  });

  it("gives a DaemonSet one tile per node", () => {
    const ds = wl({ kind: "DaemonSet" });
    expect(replicaTiles(ds, tree(ds, 2)).tiles.map((t) => t.label)).toEqual(["n1", "n2"]);
  });

  it("draws no tiles for jobs and bare pods", () => {
    for (const kind of ["CronJob", "Job", "Pod"] as const) {
      const w = wl({ kind, replicas: 3 });
      expect(replicaTiles(w, tree(w)).tiles, kind).toEqual([]);
    }
  });

  it("caps the tiles and counts the rest", () => {
    const d = wl({ replicas: 10 });
    const { tiles, more } = replicaTiles(d, tree(d));
    expect(tiles).toHaveLength(6);
    expect(more).toBe(4);
  });
});

describe("clusterOf", () => {
  it("finds the cluster through the namespace, and survives a cycle", () => {
    expect(clusterOf("wl", tree(wl()))?.id).toBe("cluster");
    const cyclic = {
      a: { id: "a", name: "a", description: "", parentId: "b", type: "k8s-namespace" } as Component,
      b: { id: "b", name: "b", description: "", parentId: "a", type: "k8s-namespace" } as Component,
    };
    expect(clusterOf("a", cyclic)).toBeUndefined();
  });
});
