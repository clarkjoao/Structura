import { describe, expect, it } from "vitest";
import type { Component, Diagram, Flow } from "@/features/diagram";
import { resolveVersionSnapshot } from "@/features/diagram";
import { buildComponentTypeCatalog, isValidNodeType } from "@/features/llm/component-catalog";
import { paletteEntriesForCategory } from "@/features/elements/element.palette";
import { getElement } from "@/features/elements/element.registry";
import { canContain } from "@/features/elements/containment";
import { buildCategoryNavItems } from "@/features/canvas/toolbar/element-picker/buildCategoryNav";
import { buildFlowHighlight, flowPlaybackOpacity } from "@/features/canvas/flow/flowState";
import { compactContainerIdsOf, resolveVisibleTarget } from "@/features/canvas/flow/visibleTarget";
import { projectReadDiagram } from "@/features/canvas/core/projectReadDiagram";
import { deployElements } from "./deploy.family";

const IDS = deployElements.map((element) => element.id);

describe("the deployment family", () => {
  it("is registered, reaches the LLM catalog and has a picker tab", () => {
    const catalog = buildComponentTypeCatalog();
    for (const id of IDS) {
      expect(getElement(id)?.family, id).toBe("deploy");
      expect(isValidNodeType(id), id).toBe(true);
      expect(catalog, id).toContain(`nodeType: "${id}"`);
    }
    const tabs = buildCategoryNavItems((key) => key, {
      all: 0,
      c4: 0,
      canvas: 0,
      registry: 0,
      nodeTemplates: 0,
      flowchart: 0,
      byFamily: {},
    }).map((item) => item.id);
    expect(tabs).toContain("deploy");
    expect(paletteEntriesForCategory("deploy").length).toBe(IDS.length);
  });

  it("a sharded store takes shards and a router, and nothing else", () => {
    expect(canContain("deploy-sharded-store", "deploy-shard")).toBe(true);
    expect(canContain("deploy-sharded-store", "deploy-shard-router")).toBe(true);
    expect(canContain("deploy-sharded-store", "system")).toBe(false);
    expect(canContain("deploy-shard", "deploy-shard")).toBe(false);
  });
});

// ─── Flow: app → router → shard-2, expanded and compact ─────────────────────

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

function diagram(collapsed: boolean): Diagram {
  const components = {
    app: comp({ id: "app", name: "Checkout", type: "container" }),
    store: comp({
      id: "store",
      name: "Pedidos",
      type: "deploy-sharded-store",
      replicationFactor: 3,
      ...(collapsed ? { collapsed: true } : {}),
    }),
    router: comp({ id: "router", name: "mongos", type: "deploy-shard-router", parentId: "store" }),
    shard1: comp({ id: "shard1", name: "shard-1", type: "deploy-shard", parentId: "store" }),
    shard2: comp({ id: "shard2", name: "shard-2", type: "deploy-shard", parentId: "store" }),
  };
  const flow: Flow = {
    id: "f",
    name: "Pedido",
    entryStepId: "s1",
    steps: {
      s1: { id: "s1", type: "action", componentId: "app", next: "s2" },
      s2: { id: "s2", type: "action", componentId: "router", next: "s3" },
      s3: { id: "s3", type: "action", componentId: "shard2" },
    },
  } as unknown as Flow;
  return {
    id: "d",
    name: "Pedidos",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components,
      connections: {
        c1: { id: "c1", sourceId: "app", targetId: "router", label: "query" },
        c2: { id: "c2", sourceId: "router", targetId: "shard2", label: "route" },
      },
      flows: { f: flow },
      iconLibrary: {},
    },
    nodeLayouts: {
      app: { elementId: "app", x: -300, y: 0, width: 200, height: 80 },
      store: { elementId: "store", x: 0, y: 0, width: 600, height: 320 },
      router: { elementId: "router", x: 16, y: 104, width: 160, height: 56 },
      shard1: { elementId: "shard1", x: 16, y: 200, width: 180, height: 80 },
      shard2: { elementId: "shard2", x: 208, y: 200, width: 180, height: 80 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

/** The reading as the viewer builds it: highlight against the drawn elements. */
function readingAt(d: Diagram, stepId: string, history: string[]) {
  const flow = d.snapshot.flows.f;
  const { components } = resolveVersionSnapshot(d, null);
  return {
    badges: null,
    highlight: buildFlowHighlight(flow, stepId, history, {
      components,
      compactIds: compactContainerIdsOf(components),
    }),
  };
}

describe("reading app → router → shard-2", () => {
  it("expanded: lights shard-2 itself, and its store stays lit", () => {
    const d = diagram(false);
    const reading = readingAt(d, "s3", ["s1", "s2"]);
    expect(reading.highlight.activeNodeId).toBe("shard2");
    expect(flowPlaybackOpacity("store", reading.highlight)).toBe(1);
    const { nodes, edges } = projectReadDiagram(d, reading);
    expect(nodes.find((n) => n.id === "shard2")?.hidden).toBeFalsy();
    expect(edges.map((e) => e.id).sort()).toEqual(["c1", "c2"]);
  });

  it("compact: lights the store, names shard-2 by its path, hides the inner edge", () => {
    const d = diagram(true);
    expect(resolveVisibleTarget(d, "shard2")).toMatchObject({
      id: "store",
      path: ["Pedidos", "shard-2"],
    });
    const reading = readingAt(d, "s3", ["s1", "s2"]);
    expect(reading.highlight.activeNodeId).toBe("store");
    const { nodes, edges } = projectReadDiagram(d, reading);
    expect(nodes.find((n) => n.id === "shard2")?.hidden).toBe(true);
    expect(nodes.find((n) => n.id === "store")?.hidden).toBeFalsy();
    expect(nodes.find((n) => n.id === "store")?.style?.opacity).toBe(1);
    // app → router is drawn on the store; router → shard-2 is inside it.
    expect(edges.find((e) => e.id === "c1")).toMatchObject({ source: "app", target: "store" });
    expect(edges.map((e) => e.id)).not.toContain("c2");
  });

  it("the step on the router reads on the store too while compact", () => {
    const reading = readingAt(diagram(true), "s2", ["s1"]);
    expect(reading.highlight.activeNodeId).toBe("store");
  });
});
