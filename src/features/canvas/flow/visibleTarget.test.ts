import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Component, Diagram, Flow } from "@/features/diagram";
import { validateFlowGraph } from "@/features/diagram";
import {
  TEST_CONTAINER,
  registerTestContainer,
  unregisterTestContainer,
} from "@/features/elements/typedContainer.fixture";
import { buildFlowHighlight, flowPlaybackOpacity } from "./flowState";
import { describeStepHeading, describeStepTarget } from "./reading/readingScene";
import { compactContainerIdsOf, resolveVisibleTarget, visibleTargetIn } from "./visibleTarget";

beforeAll(registerTestContainer);
afterAll(unregisterTestContainer);

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, type: "system", ...partial }) as unknown as Component;

/** Pedidos ⊃ Região ⊃ shard-2; app outside. Pedidos and Região are typed containers. */
function components(compact: { pedidos?: boolean; regiao?: boolean } = {}) {
  return {
    pedidos: comp({
      id: "pedidos",
      name: "Pedidos",
      type: TEST_CONTAINER,
      ...(compact.pedidos ? { collapsed: true } : {}),
    }),
    regiao: comp({
      id: "regiao",
      name: "Região",
      type: TEST_CONTAINER,
      parentId: "pedidos",
      ...(compact.regiao ? { collapsed: true } : {}),
    }),
    shard2: comp({ id: "shard2", name: "shard-2", parentId: "regiao" }),
    shard1: comp({ id: "shard1", name: "shard-1", parentId: "regiao" }),
    app: comp({ id: "app", name: "App" }),
  } as Record<string, Component>;
}

function diagram(c: Record<string, Component>, flows: Record<string, Flow> = {}): Diagram {
  return {
    id: "d",
    name: "d",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: c, connections: {}, flows, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

describe("resolveVisibleTarget", () => {
  it("is the element itself while everything around it is expanded", () => {
    expect(resolveVisibleTarget(diagram(components()), "shard2")).toEqual({
      id: "shard2",
      hidden: false,
      path: ["shard-2"],
    });
  });

  it("is the compact container, with the path down to the child", () => {
    expect(resolveVisibleTarget(diagram(components({ regiao: true })), "shard2")).toEqual({
      id: "regiao",
      hidden: true,
      path: ["Região", "shard-2"],
    });
  });

  it("is the OUTERMOST compact container when containers nest", () => {
    expect(
      resolveVisibleTarget(diagram(components({ pedidos: true, regiao: true })), "shard2"),
    ).toEqual({ id: "pedidos", hidden: true, path: ["Pedidos", "Região", "shard-2"] });
  });

  it("is null for an element not in the diagram", () => {
    expect(resolveVisibleTarget(diagram(components()), "ghost")).toBeNull();
  });

  it("never expands anything: the diagram is left as it was", () => {
    const d = diagram(components({ pedidos: true }));
    const before = JSON.stringify(d);
    resolveVisibleTarget(d, "shard2");
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe("reading a flow through a compact container", () => {
  const flow: Flow = {
    id: "f",
    name: "Pedido",
    entryStepId: "s1",
    steps: {
      s1: { id: "s1", type: "action", componentId: "app", next: "s2" },
      s2: { id: "s2", type: "action", componentId: "shard2" },
    },
  } as unknown as Flow;

  it("F2: lights the drawn container for a step on a hidden child", () => {
    const c = components({ pedidos: true });
    const h = buildFlowHighlight(flow, "s2", ["s1"], {
      components: c,
      compactIds: compactContainerIdsOf(c),
    });
    expect(h.activeNodeId).toBe("pedidos");
    expect(h.participantNodeIds.has("pedidos")).toBe(true);
    expect(h.participantNodeIds.has("shard2")).toBe(false);
  });

  it("F3: an expanded child's containers stay lit, and a lit container's children too", () => {
    const expanded = components();
    const h = buildFlowHighlight(flow, "s2", ["s1"], {
      components: expanded,
      compactIds: compactContainerIdsOf(expanded),
    });
    expect(h.activeNodeId).toBe("shard2");
    expect(flowPlaybackOpacity("regiao", h)).toBe(1);
    expect(flowPlaybackOpacity("pedidos", h)).toBe(1);
    // A sibling of the step is not the step.
    expect(flowPlaybackOpacity("shard1", h)).toBeLessThan(1);

    const compact = components({ regiao: true });
    const onContainer = buildFlowHighlight(flow, "s2", [], {
      components: compact,
      compactIds: compactContainerIdsOf(compact),
    });
    expect(flowPlaybackOpacity("regiao", onContainer)).toBe(1);
    expect(flowPlaybackOpacity("shard1", onContainer)).toBe(1);
    expect(flowPlaybackOpacity("shard2", onContainer)).toBe(1);
    expect(flowPlaybackOpacity("app", onContainer)).toBeLessThan(1);
  });

  it("F2: names the step by its path on the card, only while it is hidden", () => {
    const labels = {
      componentRemoved: "removed",
      connectionRemoved: "removed",
      endpointRemoved: "removed",
      connection: "connection",
      untitled: "untitled",
      conditionKinds: {} as never,
    };
    const hiddenIn = components({ pedidos: true });
    const ids = compactContainerIdsOf(hiddenIn);
    expect(describeStepTarget(flow.steps.s2, hiddenIn, {}, ids)?.name).toBe(
      "Pedidos › Região › shard-2",
    );
    expect(describeStepHeading(flow.steps.s2, hiddenIn, {}, labels, ids)).toBe(
      "Pedidos › Região › shard-2",
    );
    const shown = components();
    expect(describeStepTarget(flow.steps.s2, shown, {}, compactContainerIdsOf(shown))?.name).toBe(
      "shard-2",
    );
  });

  it("F6: a step on a child is valid, and stays valid when the child changes container", () => {
    const c = components();
    expect(validateFlowGraph(flow, diagram(c, { f: flow }))).toEqual([]);
    const moved = { ...c, shard2: { ...c.shard2, parentId: "pedidos" } };
    expect(validateFlowGraph(flow, diagram(moved, { f: flow }))).toEqual([]);
  });

  it("visibleTargetIn agrees with resolveVisibleTarget", () => {
    const c = components({ regiao: true });
    expect(visibleTargetIn(c, compactContainerIdsOf(c), "shard2")).toEqual(
      resolveVisibleTarget(diagram(c), "shard2"),
    );
  });
});
