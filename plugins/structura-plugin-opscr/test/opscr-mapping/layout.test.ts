import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import { pluginLayout } from "@/features/plugins/plugin-layout";
import { placeView, placeViewWith } from "../../src/opscr-mapping/layout";
import { toImporterGraph } from "../../src/opscr-mapping/importer-graph";
import { buildTechnicalView } from "../../src/opscr-mapping/technical-view";
import type { OpscrWorkspaceInput } from "../../src/opscr-mapping/types";

const sample = JSON.parse(
  readFileSync(`${__dirname}/../../src/opscr-mapping/__fixtures__/sample.workspace.json`, "utf8"),
) as OpscrWorkspaceInput;

/**
 * The library decides what is drawn; Structura sizes and places it. These run the host's own
 * `api.layout.place`, so what they check is what every channel draws.
 */
describe("placeViewWith — the sample placed by Structura", () => {
  it("places every node at the canvas's size for its type, each child inside its parent", async () => {
    const view = buildTechnicalView(sample);
    const placed = placeView(view, await placeViewWith(pluginLayout, view));

    expect(placed.nodes).toHaveLength(view.nodes.length);
    const byId = new Map(placed.nodes.map((n) => [n.id, n]));
    for (const node of placed.nodes) {
      expect(node.box.width, node.id).toBeGreaterThan(0);
      if (!node.isBoundary) {
        expect([node.box.width, node.box.height], node.id).toEqual([
          DEFAULT_NODE_W,
          DEFAULT_NODE_H,
        ]);
      }
      if (!node.parentId) continue;
      const parent = byId.get(node.parentId)!;
      expect(node.box.x, node.id).toBeGreaterThanOrEqual(0);
      expect(node.box.y, node.id).toBeGreaterThanOrEqual(0);
      expect(node.box.x + node.box.width, node.id).toBeLessThanOrEqual(parent.box.width);
      expect(node.box.y + node.box.height, node.id).toBeLessThanOrEqual(parent.box.height);
    }
  });

  it("hands the host every connection with the label the canvas draws on it", async () => {
    const view = buildTechnicalView(sample);
    const drawn = toImporterGraph(placeView(view, { boxes: new Map(), edgeRoutes: new Map() }));
    const handed: string[] = [];
    await placeViewWith(
      {
        place: async ({ graph }) => {
          handed.push(...graph.connections.map((c) => c.label));
          return { boxes: {} };
        },
      },
      view,
    );
    expect(handed.length).toBeGreaterThan(0);
    expect(handed).toEqual(drawn.connections.map((c) => c.label));
  });

  it("keeps a node the result has no box for, at the origin with no size of its own", () => {
    const view = buildTechnicalView({
      manifests: [{ kind: "Database", metadata: { name: "db" }, spec: {} }],
    });
    const [node] = placeView(view, { boxes: new Map(), edgeRoutes: new Map() }).nodes;
    expect(node!.box).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
