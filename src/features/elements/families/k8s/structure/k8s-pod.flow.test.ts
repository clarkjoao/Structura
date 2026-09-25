import { describe, expect, it } from "vitest";
import type { Component, Diagram, Flow, FlowStep } from "@/features/diagram";
import { resolveVersionSnapshot } from "@/features/diagram";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { stepsToMermaid } from "@/features/diagram/utils/flow-mermaid";
import { buildFlowHighlight } from "@/features/canvas/flow/flowState";
import {
  compactContainerIdsOf,
  formatTargetPath,
  resolveVisibleTarget,
} from "@/features/canvas/flow/visibleTarget";
import { projectReadDiagram } from "@/features/canvas/core/projectReadDiagram";
import { getElement } from "@/features/elements/element.registry";
import { canContain } from "@/features/elements/containment";
import { emptyNodeBuildContext } from "@/features/elements/node-build-context.fixture";

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

/** ingress → envoy (sidecar) → checkout-api (main), in the workload "checkout". */
function diagram(compact: boolean): Diagram {
  const components = {
    ing: comp({ id: "ing", name: "api", type: "k8s-ingress" }),
    wl: comp({
      id: "wl",
      name: "checkout",
      type: "k8s-workload",
      ...(compact ? { collapsed: true } : {}),
    }),
    envoy: comp({
      id: "envoy",
      name: "envoy",
      type: "k8s-container",
      parentId: "wl",
      podRole: "sidecar",
      purpose: "proxy",
    }),
    app: comp({ id: "app", name: "checkout-api", type: "k8s-container", parentId: "wl" }),
  };
  const flow = {
    id: "f",
    name: "Compra",
    entryStepId: "s1",
    steps: {
      s1: { id: "s1", type: "action", componentId: "ing", next: "s2" },
      s2: { id: "s2", type: "action", componentId: "envoy", next: "s3" },
      s3: { id: "s3", type: "action", componentId: "app" },
    },
  } as unknown as Flow;
  return {
    id: "d",
    name: "Pod",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components,
      connections: {
        c1: { id: "c1", sourceId: "ing", targetId: "envoy", label: "http" },
        c2: { id: "c2", sourceId: "envoy", targetId: "app", label: "localhost:8080" },
      },
      flows: { f: flow },
      iconLibrary: {},
    },
    nodeLayouts: {
      ing: { elementId: "ing", x: 0, y: 120, width: 200, height: 56 },
      wl: { elementId: "wl", x: 280, y: 0, width: 420, height: 280 },
      envoy: { elementId: "envoy", x: 12, y: 184, width: 180, height: 72 },
      app: { elementId: "app", x: 204, y: 184, width: 180, height: 72 },
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

describe("a workload's containers", () => {
  it("a workload takes containers and nothing else; a container takes nothing", () => {
    expect(canContain("k8s-workload", "k8s-container")).toBe(true);
    expect(canContain("k8s-workload", "k8s-service")).toBe(false);
    expect(canContain("k8s-container", "k8s-container")).toBe(false);
    expect(canContain("k8s-namespace", "k8s-container")).toBe(false);
  });

  it("a sidecar, not the main container, is a tab on the compact workload", () => {
    const tab = getElement("k8s-container")!.canvas.tabOnCompactParent!;
    const d = diagram(true);
    expect(tab(d.snapshot.components.envoy)).toBe(true);
    expect(tab(d.snapshot.components.app)).toBe(false);
    const data = (id: string) =>
      getElement("k8s-container")!.canvas.buildData(d.snapshot.components[id], {
        ...emptyNodeBuildContext(),
        resolvedComponents: d.snapshot.components,
      });
    expect(data("envoy")).toMatchObject({ asTab: true, podRole: "sidecar" });
    expect(data("app")).toMatchObject({ asTab: false, podRole: "main" });
  });

  it("the compact workload grows to hold its tabs; expanded, it keeps its stored size", () => {
    const workload = getElement("k8s-workload")!;
    const ctx = (d: Diagram) => ({
      ...emptyNodeBuildContext(),
      resolvedComponents: d.snapshot.components,
      resolvedNodeLayouts: d.nodeLayouts,
    });
    expect(
      workload.canvas.buildStyle!(diagram(false).snapshot.components.wl, ctx(diagram(false))),
    ).toMatchObject({ height: 280 });
    expect(
      workload.canvas.buildStyle!(diagram(true).snapshot.components.wl, ctx(diagram(true))),
    ).toMatchObject({ height: 120 });
  });
});

describe("reading ingress → envoy (sidecar) → checkout-api (main)", () => {
  it("expanded: each step lights its own container; the in-pod link is dashed teal", () => {
    const d = diagram(false);
    expect(readingAt(d, "s2", ["s1"]).highlight.activeNodeId).toBe("envoy");
    expect(readingAt(d, "s3", ["s1", "s2"]).highlight.activeNodeId).toBe("app");
    const { edges } = projectReadDiagram(d, readingAt(d, "s3", ["s1", "s2"]));
    const c2 = edges.find((e) => e.id === "c2")!;
    expect(c2.style).toMatchObject({ stroke: "hsl(var(--node-system))" });
    expect(c2.data).toMatchObject({ strokeStyle: "dashed" });
    expect(edges.find((e) => e.id === "c1")!.data).toMatchObject({ strokeStyle: "solid" });
  });

  it("compact: the step on the sidecar lights the workload and reads checkout › envoy", () => {
    const d = diagram(true);
    const target = resolveVisibleTarget(d, "envoy");
    expect(target).toMatchObject({ id: "wl", path: ["checkout", "envoy"] });
    expect(formatTargetPath(target!.path)).toBe("checkout › envoy");
    expect(readingAt(d, "s2", ["s1"]).highlight.activeNodeId).toBe("wl");
    expect(readingAt(d, "s3", ["s1", "s2"]).highlight.activeNodeId).toBe("wl");
  });

  it("compact, in the viewer: the sidecar stays as a tab and the ingress edge ends on it", () => {
    const d = diagram(true);
    const { nodes, edges } = projectReadDiagram(d, readingAt(d, "s2", ["s1"]));
    expect(nodes.find((n) => n.id === "envoy")?.hidden).toBeFalsy();
    expect(nodes.find((n) => n.id === "app")?.hidden).toBe(true);
    expect(edges.find((e) => e.id === "c1")).toMatchObject({ source: "ing", target: "envoy" });
    // envoy → main is drawn from the tab onto the card, still dashed.
    const c2 = edges.find((e) => e.id === "c2")!;
    expect(c2).toMatchObject({ source: "envoy", target: "wl" });
    expect(c2.data).toMatchObject({ strokeStyle: "dashed" });
  });

  it("the mermaid export names the containers by their path", () => {
    const d = diagram(false);
    const text = stepsToMermaid(d.snapshot.flows.f, d.snapshot.components, d.snapshot.connections);
    expect(text).toContain("as checkout › envoy");
    expect(text).toContain("as checkout › checkout-api");
    expect(text).toContain("as api");
  });
});

describe("deleting the workload sews the flow", () => {
  it("ingress → envoy → main → pg becomes ingress → pg, said once, and undoes", () => {
    const store = createTestDiagramStore();
    const created = store.getState().addDiagram("Pod", "container");
    store.getState().openDiagram(created.id);
    const s = store.getState();
    const ing = s.addComponent("k8s-ingress", "api", null, { x: 0, y: 0 });
    const wl = s.addComponent("k8s-workload", "checkout", null, { x: 300, y: 0 });
    const envoy = s.addComponent(
      "k8s-container",
      "envoy",
      wl.id,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        podRole: "sidecar",
      },
    );
    const app = s.addComponent("k8s-container", "checkout-api", wl.id);
    const db = s.addComponent("k8s-workload", "pg", null, { x: 900, y: 0 });
    const components = () => store.getState().diagrams[created.id].snapshot.components;
    expect(components()[envoy.id]).toMatchObject({ parentId: wl.id, podRole: "sidecar" });
    expect(components()[app.id]).not.toHaveProperty("podRole");
    const steps = {
      s1: { id: "s1", type: "action", componentId: ing.id, next: "s2" },
      s2: { id: "s2", type: "action", componentId: envoy.id, next: "s3" },
      s3: { id: "s3", type: "action", componentId: app.id, next: "s4" },
      s4: { id: "s4", type: "action", componentId: db.id },
    } as Record<string, FlowStep>;
    const flow = s.addFlow(created.id, "Compra", "", steps)!;
    const walk = () => {
      const f = store.getState().diagrams[created.id].snapshot.flows[flow.id];
      const out: string[] = [];
      for (let id: string | undefined = f.entryStepId; id; id = f.steps[id].next) {
        out.push(f.steps[id].componentId!);
      }
      return out;
    };
    store.getState().removeComponent(wl.id);
    expect(walk()).toEqual([ing.id, db.id]);
    const notices = store.getState()._flowSewNotices!.notices;
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ flowName: "Compra", elementName: "checkout" });
    store.getState().undo();
    expect(walk()).toEqual([ing.id, envoy.id, app.id, db.id]);
  });
});
