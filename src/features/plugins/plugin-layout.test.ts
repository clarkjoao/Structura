import { describe, expect, it } from "vitest";
import { layoutKeepingOrder } from "@/features/canvas/layout/layoutEngine";
import { pluginLayout, toLayoutGraph } from "./plugin-layout";
import type { PluginLayoutGraph } from "./plugin.types";

/** A panel holding two connected cards, and a card outside it that one of them calls. */
const graph: PluginLayoutGraph = {
  nodes: [
    { id: "panel", parentId: null, width: 240, height: 160 },
    { id: "a", parentId: "panel", width: 180, height: 80 },
    { id: "b", parentId: "panel", width: 180, height: 80 },
    { id: "c", parentId: null, width: 180, height: 80 },
  ],
  edges: [
    { id: "a-b", sourceId: "a", targetId: "b" },
    { id: "b-c", sourceId: "b", targetId: "c" },
  ],
};

describe("api.layout.arrange — the host's engine for a plugin's graph", () => {
  it("returns the host engine's boxes, relative to the parent, panels fitted to their children", async () => {
    const { boxes } = await pluginLayout.arrange(graph);
    const host = await layoutKeepingOrder(toLayoutGraph(graph));
    expect(Object.keys(boxes).sort()).toEqual(["a", "b", "c", "panel"]);
    for (const [id, box] of host.boxes) expect(boxes[id]).toEqual(box);
    // Reads left to right, and the panel holds both cards.
    expect(boxes["a"]!.x).toBeLessThan(boxes["b"]!.x);
    expect(boxes["panel"]!.width).toBeGreaterThanOrEqual(boxes["b"]!.x + boxes["b"]!.width);
    expect(boxes["panel"]!.x + boxes["panel"]!.width).toBeLessThanOrEqual(boxes["c"]!.x);
  });

  it("is deterministic", async () => {
    expect(await pluginLayout.arrange(graph)).toEqual(await pluginLayout.arrange(graph));
  });

  it("keeps the drawn order when positions are given", async () => {
    const swapped: PluginLayoutGraph = {
      nodes: [
        { id: "x", parentId: null, width: 180, height: 80, position: { x: 0, y: 400 } },
        { id: "y", parentId: null, width: 180, height: 80, position: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const { boxes } = await pluginLayout.arrange(swapped);
    expect(boxes["y"]!.y).toBeLessThan(boxes["x"]!.y);
  });

  it("drops what is malformed instead of failing", async () => {
    // Plugin data as it may arrive: JSON with no type behind it.
    const messy: PluginLayoutGraph = JSON.parse(`{
      "nodes": [
        { "id": "ok", "parentId": null, "width": 100, "height": 50 },
        { "id": "", "parentId": null, "width": 100, "height": 50 },
        { "id": "nosize", "parentId": null, "width": "wide", "height": 50 },
        { "id": "ok", "parentId": null, "width": 1, "height": 1 },
        null
      ],
      "edges": [
        { "id": "dangling", "sourceId": "ok", "targetId": "missing" },
        { "id": "self", "sourceId": "ok", "targetId": "ok" }
      ]
    }`);
    const input = toLayoutGraph(messy);
    expect(input.nodes.map((n) => n.id)).toEqual(["ok"]);
    expect(input.edges.map((e) => e.id)).toEqual(["self"]);
    const { boxes } = await pluginLayout.arrange(messy);
    expect(Object.keys(boxes)).toEqual(["ok"]);
  });

  it("an empty graph lays out to nothing", async () => {
    expect(await pluginLayout.arrange({ nodes: [], edges: [] })).toEqual({ boxes: {} });
  });
});
