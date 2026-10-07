import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { LayoutGraph } from "@/features/canvas/layout/contract";
import { layout } from "@/features/canvas/layout/layoutEngine";
import {
  EMPTY_BOUNDARY_H,
  EMPTY_BOUNDARY_W,
  LEAF_H,
  LEAF_W,
  placeView,
  toLayoutGraph,
} from "./layout";
import { buildTechnicalView } from "./technical-view";
import type { OpscrWorkspaceInput } from "./types";

const sample = JSON.parse(
  readFileSync(`${__dirname}/__fixtures__/sample.workspace.json`, "utf8"),
) as OpscrWorkspaceInput;

describe("toLayoutGraph", () => {
  it("sizes leaves, empty boundaries and boundaries with children", () => {
    const view = buildTechnicalView({
      manifests: [
        { kind: "Domain", metadata: { name: "empty" }, spec: {} },
        { kind: "ApplicationService", metadata: { name: "orders" }, spec: {} },
        { kind: "Application", metadata: { name: "api" }, spec: {} },
        {
          kind: "Relationship",
          metadata: { name: "r" },
          spec: {
            edges: [
              {
                from: { kind: "Application", id: "api" },
                to: { kind: "ApplicationService", id: "orders" },
                type: "belongsTo",
              },
            ],
          },
        },
      ],
    });
    const sizes = new Map(toLayoutGraph(view).nodes.map((n) => [n.id, [n.width, n.height]]));
    expect(sizes.get("Domain/empty")).toEqual([EMPTY_BOUNDARY_W, EMPTY_BOUNDARY_H]);
    expect(sizes.get("Application/api")).toEqual([LEAF_W, LEAF_H]);
    expect(sizes.get("ApplicationService/orders")).not.toEqual([
      EMPTY_BOUNDARY_W,
      EMPTY_BOUNDARY_H,
    ]);
  });

  it("is accepted by the app's layout contract as it is", () => {
    const graph: LayoutGraph = toLayoutGraph(buildTechnicalView(sample));
    expect(graph.nodes.length).toBeGreaterThan(0);
  });
});

describe("the sample laid out by the app's engine", () => {
  it("places every node, keeping each child inside its parent's box", async () => {
    const view = buildTechnicalView(sample);
    const placed = placeView(view, await layout(toLayoutGraph(view)));

    expect(placed.nodes).toHaveLength(view.nodes.length);
    const byId = new Map(placed.nodes.map((n) => [n.id, n]));
    for (const node of placed.nodes) {
      expect(node.box.width, node.id).toBeGreaterThan(0);
      if (!node.parentId) continue;
      const parent = byId.get(node.parentId)!;
      // Child boxes are relative to the parent.
      expect(node.box.x, node.id).toBeGreaterThanOrEqual(0);
      expect(node.box.y, node.id).toBeGreaterThanOrEqual(0);
      expect(node.box.x + node.box.width, node.id).toBeLessThanOrEqual(parent.box.width);
      expect(node.box.y + node.box.height, node.id).toBeLessThanOrEqual(parent.box.height);
    }
    expect(placed.edges.every((e) => e.route.length >= 2)).toBe(true);
  });

  it("keeps a node the result has no box for, at its seed size", () => {
    const view = buildTechnicalView({
      manifests: [{ kind: "Database", metadata: { name: "db" }, spec: {} }],
    });
    const [node] = placeView(view, { boxes: new Map(), edgeRoutes: new Map() }).nodes;
    expect(node.box).toEqual({ x: 0, y: 0, width: LEAF_W, height: LEAF_H });
  });
});
