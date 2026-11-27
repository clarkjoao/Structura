import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { placeWorkspaceView, setHostLayout } from "./layout";
import { buildTechnicalView, type OpscrWorkspaceInput } from "./opscr-mapping";
import type { PluginLayout, PluginPlaceInput } from "./types/plugin.types";

const sample = JSON.parse(
  readFileSync(`${__dirname}/opscr-mapping/__fixtures__/sample.workspace.json`, "utf8"),
) as OpscrWorkspaceInput;
const view = buildTechnicalView(sample);

describe("placeWorkspaceView — Structura places the view (api.layout.place)", () => {
  it("places every element, children relative to their panel, no routes", async () => {
    const { boxes, edgeRoutes } = await placeWorkspaceView(view);
    expect([...boxes.keys()].sort()).toEqual(view.nodes.map((n) => n.id).sort());
    expect(edgeRoutes.size).toBe(0);
    for (const node of view.nodes) {
      const box = boxes.get(node.id)!;
      expect(box.width, node.id).toBeGreaterThan(0);
      if (node.parentId === null) continue;
      const parent = boxes.get(node.parentId)!;
      expect(box.x + box.width, node.id).toBeLessThanOrEqual(parent.width);
      expect(box.y + box.height, node.id).toBeLessThanOrEqual(parent.height);
    }
  });

  it("keeps what is drawn exactly where it is", async () => {
    const first = await placeWorkspaceView(view);
    const again = await placeWorkspaceView(view, first);
    for (const [id, box] of first.boxes) expect(again.boxes.get(id), id).toMatchObject(box);
  });

  it("hands the host the importer graph, what is drawn under which parent, and the diagram", async () => {
    const seen: PluginPlaceInput[] = [];
    const fake: PluginLayout = {
      arrange: async () => ({ boxes: {} }),
      place: async (input) => {
        seen.push(input);
        return { boxes: {} };
      },
    };
    const host = setHostLayout(fake);
    try {
      const leaf = view.nodes.find((n) => n.parentId !== null)!;
      await placeWorkspaceView(
        view,
        {
          boxes: new Map([[leaf.id, { x: 10, y: 20, width: 0, height: 0 }]]),
          edgeRoutes: new Map(),
          parents: new Map([[leaf.id, "#elsewhere"]]),
        },
        "d1",
      );
      const input = seen[0]!;
      expect(input.diagramId).toBe("d1");
      expect(input.graph.components.map((c) => c.key).sort()).toEqual(
        view.nodes.map((n) => n.id).sort(),
      );
      // Labelled as drawn, so the host makes room for the labels.
      expect(input.graph.connections.every((c) => typeof c.label === "string")).toBe(true);
      expect(input.previous).toEqual({
        [leaf.id]: { x: 10, y: 20, width: 0, height: 0, parentKey: "#elsewhere" },
      });
    } finally {
      if (host) setHostLayout(host);
    }
  });
});
