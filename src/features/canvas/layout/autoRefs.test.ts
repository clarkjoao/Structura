import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import type { Component } from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import {
  AUTO_REF_MIN_EDGES,
  chooseAutoRefs,
  isBetterLayout,
  planAutoRefHubs,
  planAutoRefs,
  splitGraph,
  type AutoRefPlanOptions,
} from "./autoRefs";
import { autoRefOptionsFor, withoutAutoRefs } from "./autoRefsFromDiagram";
import type { LayoutGraph, LayoutResult } from "./contract";

const node = (id: string, parentId: string | null = null) => ({
  id,
  parentId,
  width: 100,
  height: 50,
});
const edge = (id: string, sourceId: string, targetId: string) => ({ id, sourceId, targetId });

const OPTIONS: AutoRefPlanOptions = {
  canReference: (id) => !id.startsWith("p"),
  refParentFor: (parentId) => parentId,
  refIdFor: (originalId, parentId) => `ref:${originalId}:${parentId ?? "root"}`,
  refSize: { width: 200, height: 48 },
};

/** Hub `h` at the root, used from p1 (twice), p2, and once from beside it. */
const HUB: LayoutGraph = {
  nodes: [
    node("p1"),
    node("p2"),
    node("h"),
    node("a", "p1"),
    node("b", "p1"),
    node("c", "p2"),
    node("d"),
  ],
  edges: [edge("ah", "a", "h"), edge("bh", "b", "h"), edge("ch", "c", "h"), edge("dh", "d", "h")],
};

describe("planAutoRefs", () => {
  it("gives a hub one reference per consumer container, not one per edge", () => {
    // p2 uses the hub once: too few for a reference, so `ch` stays on the original.
    expect(planAutoRefs(HUB, OPTIONS)).toEqual([
      [
        {
          refId: "ref:h:p1",
          originalId: "h",
          parentId: "p1",
          sourceIds: ["a", "b"],
          edgeIds: ["ah", "bh"],
        },
      ],
    ]);
  });

  it("never makes a reference with fewer than two edges", () => {
    for (const groups of planAutoRefs(HUB, OPTIONS)) {
      for (const group of groups) {
        expect(group.edgeIds.length, group.refId).toBeGreaterThanOrEqual(AUTO_REF_MIN_EDGES);
      }
    }
  });

  it("gathers lone edges from inner containers into a reference further out", () => {
    // q holds q1 and q2, each using the hub once: one reference in q, for both.
    const graph: LayoutGraph = {
      nodes: [
        node("pq"),
        node("pq1", "pq"),
        node("pq2", "pq"),
        node("h"),
        node("x", "pq1"),
        node("y", "pq2"),
        node("d"),
      ],
      edges: [edge("xh", "x", "h"), edge("yh", "y", "h"), edge("dh", "d", "h")],
    };
    expect(planAutoRefs(graph, OPTIONS)).toEqual([
      [
        {
          refId: "ref:h:pq",
          originalId: "h",
          parentId: "pq",
          sourceIds: ["x", "y"],
          edgeIds: ["xh", "yh"],
        },
      ],
    ]);
  });

  it("offers a container's lone edge as a one-edge reference to try on its own", () => {
    const [hub] = planAutoRefHubs(HUB, OPTIONS);
    expect(hub?.lone).toEqual([
      { refId: "ref:h:p2", originalId: "h", parentId: "p2", sourceIds: ["c"], edgeIds: ["ch"] },
    ]);
    expect(hub?.maxLone).toBe(1);
  });

  it("never lets lone references take the original's last edge", () => {
    // h used once from p1 and once from p2, from nowhere beside it: one of the
    // two lone edges has to stay on the original.
    const graph: LayoutGraph = {
      nodes: [node("p1"), node("p2"), node("h"), node("a", "p1"), node("c", "p2")],
      edges: [edge("ah", "a", "h"), edge("ch", "c", "h")],
    };
    const [hub] = planAutoRefHubs(graph, OPTIONS);
    expect(hub?.groups).toEqual([]);
    expect(hub?.lone).toHaveLength(2);
    expect(hub?.maxLone).toBe(1);
  });

  it("leaves the busiest container on the original when nothing uses it from beside it", () => {
    const graph: LayoutGraph = {
      nodes: [...HUB.nodes, node("c2", "p2")],
      edges: [...HUB.edges.filter((e) => e.id !== "dh"), edge("c2h", "c2", "h")],
    };
    const [groups] = planAutoRefs(graph, OPTIONS);
    // p1 and p2 use it twice each and nothing beside it does: p1 stays on the original.
    expect(groups?.map((g) => g.parentId)).toEqual(["p2"]);
  });

  it("is nothing for a node used a little, from one place", () => {
    const graph: LayoutGraph = {
      nodes: [node("p1"), node("h"), node("a", "p1"), node("b", "p1")],
      edges: [edge("ah", "a", "h"), edge("bh", "b", "h")],
    };
    expect(planAutoRefs(graph, OPTIONS)).toEqual([]);
  });

  it("never references what the caller refuses", () => {
    expect(planAutoRefs(HUB, { ...OPTIONS, canReference: () => false })).toEqual([]);
  });

  it("puts the reference where the caller says a container takes it", () => {
    const [groups] = planAutoRefs(HUB, {
      ...OPTIONS,
      refParentFor: (parentId) => (parentId === "p2" ? null : parentId),
    });
    // p2 does not take one: its consumer is as good as beside the original.
    expect(groups?.map((g) => g.parentId)).toEqual(["p1"]);
  });
});

describe("splitGraph", () => {
  it("adds the references and ends their edges there, leaving the rest", () => {
    const [groups] = planAutoRefs(HUB, OPTIONS);
    const split = splitGraph(HUB, groups!, OPTIONS.refSize);
    expect(split.nodes).toContainEqual({ id: "ref:h:p1", parentId: "p1", width: 200, height: 48 });
    expect(split.edges.find((e) => e.id === "ah")?.targetId).toBe("ref:h:p1");
    expect(split.edges.find((e) => e.id === "dh")?.targetId).toBe("h");
  });
});

describe("isBetterLayout", () => {
  const score = (edgeCrossings: number, edgeNodeOverlaps: number, length: number) => ({
    edgeCrossings,
    edgeNodeOverlaps,
    length,
  });
  it("prefers fewer crossings, and weighs an edge through a node as two", () => {
    expect(isBetterLayout(score(3, 0, 100), score(4, 0, 100))).toBe(true);
    expect(isBetterLayout(score(1, 1, 100), score(2, 0, 100))).toBe(false);
    expect(isBetterLayout(score(0, 1, 100), score(3, 0, 100))).toBe(true);
  });
  it("breaks a tie only on a much shorter route", () => {
    expect(isBetterLayout(score(2, 0, 70), score(2, 0, 100))).toBe(true);
    expect(isBetterLayout(score(2, 0, 90), score(2, 0, 100))).toBe(false);
  });
});

describe("chooseAutoRefs", () => {
  /** Every node in a row, no routes: nothing crosses, whatever the trial. */
  const rowResult = (graph: LayoutGraph): LayoutResult => {
    const boxes = new Map(graph.nodes.map((n, i) => [n.id, { x: i * 300, y: 0, ...n }]));
    return {
      boxes,
      edgeRoutes: new Map(),
      handleOrder: { outgoing: new Map(), incoming: new Map() },
      bounds: { width: 1000, height: 1000 },
    };
  };

  it("keeps the unsplit layout when no trial reads better", async () => {
    // Without c's lone edge: one trial, p1's reference.
    const graph: LayoutGraph = { ...HUB, edges: HUB.edges.filter((e) => e.id !== "ch") };
    const runs: LayoutGraph[] = [];
    const choice = await chooseAutoRefs(graph, OPTIONS, async (trial) => {
      runs.push(trial);
      return rowResult(trial);
    });
    expect(runs).toHaveLength(2);
    expect(choice.groups).toEqual([]);
    expect(choice.graph).toBe(graph);
  });

  it("tries each lone edge on its own, after the hubs", async () => {
    const runs: LayoutGraph[] = [];
    await chooseAutoRefs(HUB, OPTIONS, async (trial) => {
      runs.push(trial);
      return rowResult(trial);
    });
    // The unsplit layout, p1's reference, then p2's lone edge as a reference.
    expect(runs).toHaveLength(3);
    expect(runs[2]!.nodes.map((n) => n.id)).toContain("ref:h:p2");
  });
});

const comp = (id: string, extra: Partial<Component> & Record<string, unknown> = {}): Component =>
  ({ id, type: "container", name: id, parentId: null, ...extra }) as Component;
const conn = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

describe("withoutAutoRefs", () => {
  it("folds an automatic reference back into its original, on both ends", () => {
    const components = {
      h: comp("h"),
      a: comp("a"),
      r: comp("r", { type: "shared-ref", refOf: "h", auto: true }),
      mine: comp("mine", { type: "shared-ref", refOf: "h" }),
    };
    const planned = withoutAutoRefs(components, [
      conn("ar", "a", "r"),
      conn("ra", "r", "a"),
      conn("am", "a", "mine"),
    ]);
    expect(Object.keys(planned.components).sort()).toEqual(["a", "h", "mine"]);
    expect(planned.connections.map((c) => [c.sourceId, c.targetId])).toEqual([
      ["a", "h"],
      ["h", "a"],
      ["a", "mine"],
    ]);
  });
});

describe("autoRefOptionsFor", () => {
  it("references plain elements, not a badge the user chose, a panel or a reference", () => {
    const options = autoRefOptionsFor({
      h: comp("h"),
      badge: comp("badge", { shared: { mode: "badge" } }),
      p: comp("p", { type: "panel" }),
      r: comp("r", { type: "shared-ref", refOf: "h" }),
    });
    expect(["h", "badge", "p", "r"].filter(options.canReference)).toEqual(["h"]);
  });

  it("reuses the id of an automatic reference already in the same place", () => {
    const options = autoRefOptionsFor({
      h: comp("h"),
      p: comp("p", { type: "panel" }),
      r: comp("r", { type: "shared-ref", refOf: "h", parentId: "p", auto: true }),
    });
    expect(options.refIdFor("h", "p")).toBe("r");
    expect(options.refIdFor("h", null)).not.toBe("r");
  });
});
