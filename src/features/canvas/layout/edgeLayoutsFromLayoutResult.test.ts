import { describe, expect, it } from "vitest";
import { edgeLayoutsFromLayoutResult } from "./edgeLayoutsFromLayoutResult";
import type { LayoutGraph, LayoutResult } from "./contract";

function makeGraph(): LayoutGraph {
  return {
    nodes: [
      { id: "a", parentId: null, width: 180, height: 80 },
      { id: "b", parentId: null, width: 180, height: 80 },
    ],
    edges: [{ id: "e1", sourceId: "a", targetId: "b" }],
  };
}

function makeResult(graph: LayoutGraph): LayoutResult {
  return {
    boxes: new Map(graph.nodes.map((n) => [n.id, { x: 0, y: 0, width: 180, height: 80 }])),
    edgeRoutes: new Map([
      [
        "e1",
        [
          { x: 180, y: 40 },
          { x: 250, y: 40 },
          { x: 250, y: 120 },
          { x: 360, y: 120 },
        ],
      ],
    ]),
    handleOrder: {
      outgoing: new Map([["a", ["e1"]]]),
      incoming: new Map([["b", ["e1"]]]),
    },
    bounds: { width: 400, height: 200 },
  };
}

describe("edgeLayoutsFromLayoutResult", () => {
  it("returns handle-aligned control points for each edge", () => {
    const graph = makeGraph();
    const result = makeResult(graph);
    const layouts = edgeLayoutsFromLayoutResult(graph, result);
    const points = layouts.e1?.points ?? [];
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.id).toMatch(/^cp/);
      expect(typeof point.x).toBe("number");
      expect(typeof point.y).toBe("number");
    }
  });

  it("clears points when resetPaths is true", () => {
    const graph = makeGraph();
    const result = makeResult(graph);
    const layouts = edgeLayoutsFromLayoutResult(graph, result, { resetPaths: true });
    expect(layouts.e1).toEqual({ points: [] });
  });
});
