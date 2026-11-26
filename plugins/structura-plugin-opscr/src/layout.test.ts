import { describe, expect, it } from "vitest";
import { layoutView, setHostLayout } from "./layout";
import type { PluginLayoutGraph } from "./types/plugin.types";
import type { ViewLayoutGraph } from "./generated/opscr-mapping";

const graph: ViewLayoutGraph = {
  nodes: [
    { id: "shop", parentId: null, width: 240, height: 160 },
    { id: "api", parentId: "shop", width: 180, height: 80 },
    { id: "db", parentId: "shop", width: 180, height: 80 },
  ],
  edges: [{ id: "api-db", sourceId: "api", targetId: "db" }],
};

describe("layoutView — the host's engine through api.layout", () => {
  it("lays the view out left to right, boxes relative to the parent, no routes", async () => {
    const { boxes, edgeRoutes } = await layoutView(graph);
    expect([...boxes.keys()].sort()).toEqual(["api", "db", "shop"]);
    expect(boxes.get("api")!.x).toBeLessThan(boxes.get("db")!.x);
    const shop = boxes.get("shop")!;
    const db = boxes.get("db")!;
    expect(shop.width).toBeGreaterThanOrEqual(db.x + db.width);
    expect(edgeRoutes.size).toBe(0);
  });

  it("hands a seed over as the nodes' positions, and nothing else", async () => {
    const seen: PluginLayoutGraph[] = [];
    const host = setHostLayout({
      arrange: async (g) => {
        seen.push(g);
        return { boxes: { api: { x: 1, y: 2, width: 3, height: 4 } } };
      },
    });
    try {
      const result = await layoutView(
        graph,
        new Map([["api", { x: 10, y: 20, width: 1, height: 1 }]]),
      );
      expect(seen[0]!.nodes.find((n) => n.id === "api")!.position).toEqual({ x: 10, y: 20 });
      expect(seen[0]!.nodes.find((n) => n.id === "db")!.position).toBeUndefined();
      expect(seen[0]!.edges).toEqual(graph.edges);
      expect(result.boxes.get("api")).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    } finally {
      if (host) setHostLayout(host);
    }
  });
});
