import { describe, expect, it } from "vitest";
import type { LayoutGraph } from "./contract";
import { layout } from "./layoutEngine";
import { orderLayoutGraph } from "./layoutOrder";

/** One graph whose ids come from `idOf`: same content, different ids. */
function graphWith(idOf: (name: string) => string): LayoutGraph {
  const names = ["web", "api", "db", "queue", "worker", "cache"];
  const id = (name: string): string => idOf(name);
  return {
    nodes: names.map((name) => ({
      id: id(name),
      parentId: null,
      width: 160,
      height: 80,
      sortKey: `container\u0000${name}`,
    })),
    edges: [
      ["web", "api", "calls"],
      ["api", "db", ""],
      ["api", "queue", "publishes"],
      ["queue", "worker", ""],
      ["worker", "db", ""],
      ["api", "cache", ""],
      ["web", "cache", ""],
    ].map(([from, to, label]) => ({
      id: `${id(from!)}>${id(to!)}`,
      sourceId: id(from!),
      targetId: id(to!),
      ...(label && { labelBox: { text: label, width: 60, height: 16 } }),
    })),
  };
}

const NAMES = ["web", "api", "db", "queue", "worker", "cache"];
const keyOf = (graph: LayoutGraph) => new Map(graph.nodes.map((n) => [n.id, n.sortKey]));

describe("orderLayoutGraph", () => {
  it("orders by content whatever the ids are", () => {
    const a = orderLayoutGraph(graphWith((name) => `a-${name}`));
    const b = orderLayoutGraph(
      graphWith((name) => `z${NAMES.length - NAMES.indexOf(name)}-${name}`),
    );
    const aKeys = keyOf(a);
    const bKeys = keyOf(b);
    expect(a.nodes.map((n) => n.sortKey)).toEqual(b.nodes.map((n) => n.sortKey));
    const ends = (g: LayoutGraph, keys: Map<string, string | undefined>) =>
      g.edges.map((e) => [keys.get(e.sourceId), keys.get(e.targetId), e.labelBox?.text]);
    expect(ends(a, aKeys)).toEqual(ends(b, bKeys));
  });

  it("breaks a tie between identical nodes by id, so the order is total", () => {
    const twin = (id: string) => ({ id, parentId: null, width: 10, height: 10 });
    const out = orderLayoutGraph({ nodes: [twin("b"), twin("a")], edges: [] });
    expect(out.nodes.map((n) => n.id)).toEqual(["a", "b"]);
  });
});

describe("layout — ids are not information", () => {
  it("places the same content identically under different ids", async () => {
    const first = graphWith((name) => `a-${name}`);
    const second = graphWith((name) => `${NAMES.length - NAMES.indexOf(name)}${name}-x`);
    const [one, two] = await Promise.all([layout(first), layout(second)]);
    for (const name of NAMES) {
      expect(two.boxes.get(`${NAMES.length - NAMES.indexOf(name)}${name}-x`), name).toEqual(
        one.boxes.get(`a-${name}`),
      );
    }
    expect(two.bounds).toEqual(one.bounds);
  });
});
