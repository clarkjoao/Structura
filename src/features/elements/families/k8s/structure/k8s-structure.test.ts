import { describe, expect, it } from "vitest";
import type { Component, Diagram, Flow, FlowStep } from "@/features/diagram";
import { resolveVersionSnapshot } from "@/features/diagram";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import {
  buildCloudFamilyCatalogCompact,
  buildComponentTypeCatalog,
  isValidNodeType,
} from "@/features/llm/component-catalog";
import { listElementFamilies, searchElements } from "@/features/llm/element-catalog-query";
import { getElement } from "@/features/elements/element.registry";
import { canContain } from "@/features/elements/containment";
import { familyOwnElements } from "@/features/elements/families/cloud-family.registry";
import { buildFlowHighlight } from "@/features/canvas/flow/flowState";
import { compactContainerIdsOf, resolveVisibleTarget } from "@/features/canvas/flow/visibleTarget";
import { projectReadDiagram } from "@/features/canvas/core/projectReadDiagram";
import { emptyNodeBuildContext } from "@/features/elements/node-build-context.fixture";
import { k8sStructureElements } from "./k8s-structure.elements";
import { serviceChip } from "./k8s-entry.element";

const IDS = k8sStructureElements.map((element) => element.id);

describe("kubernetes structure", () => {
  it("belongs to the k8s family, beside its service categories", () => {
    for (const id of IDS) {
      expect(getElement(id)?.family, id).toBe("k8s");
      expect(isValidNodeType(id), id).toBe(true);
    }
    expect(familyOwnElements("k8s").map((element) => element.id)).toEqual(IDS);
    // The categories stay categories.
    expect(familyOwnElements("k8s").map((e) => e.id)).not.toContain("k8s-workloads");
  });

  it("reaches the LLM: its catalog block, search and the family list", () => {
    const block = buildCloudFamilyCatalogCompact("k8s");
    for (const id of IDS) expect(block, id).toContain(`- ${id} — `);
    expect(buildComponentTypeCatalog()).toContain("- k8s-namespace — Namespace");
    const hits = searchElements({ query: "namespace" }).results;
    expect(hits).toContainEqual(
      expect.objectContaining({ elementType: "k8s-namespace", serviceId: null, familyId: "k8s" }),
    );
    // A category filter is about services; the structure is not in one.
    expect(
      searchElements({ query: "namespace", categoryId: "k8s-workloads" }).results.map(
        (r) => r.elementType,
      ),
    ).not.toContain("k8s-namespace");
    const family = listElementFamilies().families.find((f) => f.id === "k8s")!;
    const services = family.categories.reduce((n, c) => n + c.serviceCount, 0);
    expect(family.elementCount).toBe(services + IDS.length);
  });

  it("nests cluster ⊃ namespace ⊃ workload, service, ingress, and nothing else", () => {
    expect(canContain("k8s-cluster", "k8s-namespace")).toBe(true);
    expect(canContain("k8s-cluster", "k8s-workload")).toBe(true);
    expect(canContain("k8s-namespace", "k8s-workload")).toBe(true);
    expect(canContain("k8s-namespace", "k8s-service")).toBe(true);
    expect(canContain("k8s-namespace", "k8s-ingress")).toBe(true);
    expect(canContain("k8s-namespace", "k8s-namespace")).toBe(false);
    expect(canContain("k8s-namespace", "k8s-cluster")).toBe(false);
    expect(canContain("k8s-cluster", "system")).toBe(false);
    expect(canContain("k8s-workload", "system")).toBe(false);
  });

  it("every element is a connectable node that can sit in a container", () => {
    for (const element of k8sStructureElements) {
      expect(element.canvas.connectable, element.id).toBe(true);
      expect(element.canvas.canBeConnectionSource, element.id).toBe(true);
      expect(element.canvas.canHaveParent, element.id).toBe(true);
    }
    // Compact, a workload's height comes from its sidecar tabs.
    expect(getElement("k8s-workload")!.canvas.derivesSize).toBe(true);
  });

  it("exports ×N only for kinds that keep replicas, and HPA only with both bounds", () => {
    const exportLabel = (extra: Record<string, unknown>) => {
      const w = comp({ id: "w", name: "w", type: "k8s-workload", replicas: 2, ...extra });
      const node = getElement("k8s-workload")!.export.drawio.toExportNode(w, {
        id: "w",
        parentId: null,
        x: 0,
        y: 0,
        width: 240,
        height: 120,
      });
      return (node as { label: string }).label;
    };
    expect(exportLabel({ kind: "DaemonSet" })).toContain("DaemonSet · ×3");
    expect(exportLabel({ kind: "Job" })).not.toContain("×");
    expect(exportLabel({ hpaMin: 2 })).not.toContain("HPA");
    expect(exportLabel({ hpaMin: 2, hpaMax: 5 })).toContain("HPA 2–5");
  });

  it("badges a workload in a meshed namespace, without adding a container", () => {
    const workload = getElement("k8s-workload")!;
    const ns = comp({ id: "ns", name: "shop", type: "k8s-namespace", meshInjection: true });
    const w = comp({ id: "w", name: "api", type: "k8s-workload", parentId: "ns" });
    const ctx = { ...emptyNodeBuildContext(), resolvedComponents: { ns, w } };
    expect(workload.canvas.buildData(w, ctx)).toMatchObject({ meshed: true, initCount: 0 });
    const plain = { ...ctx, resolvedComponents: { ns: { ...ns, meshInjection: undefined }, w } };
    expect(workload.canvas.buildData(w, plain as never)).toMatchObject({ meshed: false });
    const exported = workload.export.drawio.toExportNode(
      w,
      { id: "w", parentId: "ns", x: 0, y: 0, width: 240, height: 120 },
      { components: { ns, w }, layouts: {} },
    ) as { representations: { id: string; label: string }[] };
    expect(exported.representations.find((r) => r.id === "w-mesh")?.label).toBe("mesh");
    expect(Object.keys(ctx.resolvedComponents)).toEqual(["ns", "w"]);
  });

  it("names a service by its type and port", () => {
    const base = {
      id: "s",
      name: "s",
      description: "",
      parentId: null,
      type: "k8s-service" as const,
    };
    expect(serviceChip(base)).toBe("ClusterIP");
    expect(serviceChip({ ...base, port: 8080 })).toBe("ClusterIP :8080");
    expect(serviceChip({ ...base, serviceType: "LoadBalancer", port: 443 })).toBe(
      "LoadBalancer :443",
    );
  });

  it("draws a workload's pods from its data, and stacks it past one replica", () => {
    const workload = getElement("k8s-workload")!;
    const cluster = {
      id: "c",
      name: "prod",
      description: "",
      parentId: null,
      type: "k8s-cluster",
      nodeCount: 4,
    } as unknown as Component;
    const ds = {
      id: "w",
      name: "agent",
      description: "",
      parentId: "c",
      type: "k8s-workload",
      kind: "DaemonSet",
    } as unknown as Component;
    const ctx = { ...emptyNodeBuildContext(), resolvedComponents: { c: cluster, w: ds } };
    expect(workload.canvas.buildData(ds, ctx)).toMatchObject({
      kind: "DaemonSet",
      replicas: 4,
      stacked: true,
      tiles: [{ label: "n1" }, { label: "n2" }, { label: "n3" }, { label: "n4" }],
    });
    const pod = { ...ds, kind: "Pod" } as unknown as Component;
    expect(
      workload.canvas.buildData(pod, { ...ctx, resolvedComponents: { c: cluster, w: pod } }),
    ).toMatchObject({ replicas: 1, stacked: false, tiles: [] });
  });
});

// ─── Flow: ingress → service → workload, then the database ───────────────────

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

function diagram(compact: boolean): Diagram {
  const components = {
    cluster: comp({ id: "cluster", name: "prod", type: "k8s-cluster" }),
    ing: comp({ id: "ing", name: "api", type: "k8s-ingress", parentId: "cluster" }),
    ns: comp({
      id: "ns",
      name: "checkout",
      type: "k8s-namespace",
      parentId: "cluster",
      ...(compact ? { collapsed: true } : {}),
    }),
    svc: comp({ id: "svc", name: "checkout-svc", type: "k8s-service", parentId: "ns" }),
    app: comp({ id: "app", name: "checkout-api", type: "k8s-workload", parentId: "ns" }),
  };
  const flow = {
    id: "f",
    name: "Compra",
    entryStepId: "s1",
    steps: {
      s1: { id: "s1", type: "action", componentId: "ing", next: "s2" },
      s2: { id: "s2", type: "action", componentId: "svc", next: "s3" },
      s3: { id: "s3", type: "action", componentId: "app" },
    },
  } as unknown as Flow;
  return {
    id: "d",
    name: "K8s",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components,
      connections: {
        c1: { id: "c1", sourceId: "ing", targetId: "svc", label: "/buy" },
        c2: { id: "c2", sourceId: "svc", targetId: "app", label: "8080" },
      },
      flows: { f: flow },
      iconLibrary: {},
    },
    nodeLayouts: {
      cluster: { elementId: "cluster", x: 0, y: 0, width: 900, height: 480 },
      ing: { elementId: "ing", x: 20, y: 80, width: 200, height: 56 },
      ns: { elementId: "ns", x: 260, y: 80, width: 600, height: 360 },
      svc: { elementId: "svc", x: 20, y: 80, width: 200, height: 56 },
      app: { elementId: "app", x: 300, y: 80, width: 240, height: 120 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

function readingAt(d: Diagram, stepId: string, history: string[]) {
  const { components } = resolveVersionSnapshot(d, null);
  return {
    badges: null,
    highlight: buildFlowHighlight(d.snapshot.flows.f, stepId, history, {
      components,
      compactIds: compactContainerIdsOf(components),
    }),
  };
}

describe("reading ingress → service → workload", () => {
  it("expanded: lights the workload itself", () => {
    const reading = readingAt(diagram(false), "s3", ["s1", "s2"]);
    expect(reading.highlight.activeNodeId).toBe("app");
    const { edges } = projectReadDiagram(diagram(false), reading);
    expect(edges.map((e) => e.id).sort()).toEqual(["c1", "c2"]);
  });

  it("namespace compact: the service and workload steps read on the namespace", () => {
    const d = diagram(true);
    expect(resolveVisibleTarget(d, "app")).toMatchObject({
      id: "ns",
      path: ["checkout", "checkout-api"],
    });
    expect(readingAt(d, "s2", ["s1"]).highlight.activeNodeId).toBe("ns");
    const reading = readingAt(d, "s3", ["s1", "s2"]);
    expect(reading.highlight.activeNodeId).toBe("ns");
    const { nodes, edges } = projectReadDiagram(d, reading);
    expect(nodes.find((n) => n.id === "app")?.hidden).toBe(true);
    // ingress → service lands on the namespace; service → workload is inside it.
    expect(edges.find((e) => e.id === "c1")).toMatchObject({ source: "ing", target: "ns" });
    expect(edges.map((e) => e.id)).not.toContain("c2");
  });
});

describe("deleting the namespace sews the flow", () => {
  function setup() {
    const store = createTestDiagramStore();
    const d = store.getState().addDiagram("K8s", "container");
    store.getState().openDiagram(d.id);
    const s = store.getState();
    const cluster = s.addComponent("k8s-cluster", "prod", null, { x: 0, y: 0 });
    const ing = s.addComponent("k8s-ingress", "api", cluster.id);
    const ns = s.addComponent("k8s-namespace", "checkout", cluster.id);
    const svc = s.addComponent("k8s-service", "checkout-svc", ns.id);
    const app = s.addComponent("k8s-workload", "checkout-api", ns.id);
    const db = s.addComponent("k8s-workload", "pg", cluster.id);
    const steps = {
      s1: { id: "s1", type: "action", componentId: ing.id, next: "s2" },
      s2: { id: "s2", type: "action", componentId: svc.id, next: "s3" },
      s3: { id: "s3", type: "action", componentId: app.id, next: "s4" },
      s4: { id: "s4", type: "action", componentId: db.id },
    } as Record<string, FlowStep>;
    const flow = s.addFlow(d.id, "Compra", "", steps)!;
    return { store, diagramId: d.id, flowId: flow.id, ing, ns, svc, app, db };
  }

  const walk = (ctx: ReturnType<typeof setup>) => {
    const flow = ctx.store.getState().diagrams[ctx.diagramId].snapshot.flows[ctx.flowId];
    const out: string[] = [];
    let id = flow.entryStepId;
    while (id) {
      out.push(flow.steps[id].componentId!);
      id = flow.steps[id].next;
    }
    return out;
  };

  it("keeps the parents it was given: namespace in cluster, service in namespace", () => {
    const ctx = setup();
    const components = ctx.store.getState().diagrams[ctx.diagramId].snapshot.components;
    expect(components[ctx.ns.id].parentId).toBe(components[ctx.ing.id].parentId);
    expect(components[ctx.svc.id].parentId).toBe(ctx.ns.id);
    expect(components[ctx.app.id].parentId).toBe(ctx.ns.id);
  });

  it("ingress → service → workload → pg becomes ingress → pg, said once", () => {
    const ctx = setup();
    ctx.store.getState().removeComponent(ctx.ns.id);
    expect(walk(ctx)).toEqual([ctx.ing.id, ctx.db.id]);
    const notices = ctx.store.getState()._flowSewNotices!.notices;
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ flowName: "Compra", elementName: "checkout" });
    ctx.store.getState().undo();
    expect(walk(ctx)).toEqual([ctx.ing.id, ctx.svc.id, ctx.app.id, ctx.db.id]);
  });

  it("refuses a namespace inside a namespace: it lands at the top level", () => {
    const ctx = setup();
    const inner = ctx.store.getState().addComponent("k8s-namespace", "nested", ctx.ns.id);
    const components = ctx.store.getState().diagrams[ctx.diagramId].snapshot.components;
    expect(components[inner.id].parentId).toBeNull();
  });
});

describe("kubernetes structure — nothing written by default", () => {
  it("creates each element with no field beyond the base ones", () => {
    const store = createTestDiagramStore();
    const d = store.getState().addDiagram("K8s", "container");
    store.getState().openDiagram(d.id);
    for (const id of IDS) {
      const created = store.getState().addComponent(id as never, id, null, { x: 0, y: 0 });
      const stored = store.getState().diagrams[d.id].snapshot.components[created.id];
      expect(Object.keys(stored).sort(), id).toEqual(
        ["description", "id", "name", "parentId", "type"].sort(),
      );
    }
  });

  it("render and export read the diagram and leave its checksum alone", async () => {
    const { snapshotChecksum } = await import("@/features/collaboration/utils/snapshotChecksum");
    const d = diagram(true);
    const surface = () => ({ ...d.snapshot, nodeLayouts: d.nodeLayouts, edgeLayouts: {} });
    const before = snapshotChecksum(surface());
    const json = JSON.stringify(d);
    const components = d.snapshot.components;
    const ctx = {
      ...emptyNodeBuildContext(),
      resolvedComponents: components,
      resolvedNodeLayouts: d.nodeLayouts,
    };
    for (const component of Object.values(components)) {
      const descriptor = getElement(component.type)!;
      descriptor.canvas.buildData(component, ctx);
      descriptor.canvas.buildStyle?.(component, ctx);
      descriptor.export.drawio.toExportNode(
        component,
        { id: component.id, parentId: component.parentId, x: 0, y: 0, width: 200, height: 80 },
        { components, layouts: d.nodeLayouts },
      );
    }
    projectReadDiagram(d, readingAt(d, "s3", ["s1", "s2"]));
    expect(JSON.stringify(d)).toBe(json);
    expect(snapshotChecksum(surface())).toBe(before);
  });
});
