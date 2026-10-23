import { describe, expect, it } from "vitest";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { transposeGraph, transposeResult, inDirection } from "./axis";
import type { LayoutGraph } from "./contract";
import { layout } from "./layoutEngine";
import { planDiagramAutoLayout } from "./autoLayoutDiagram";
import { placeIncrementally } from "./incrementalPlacement";
import { REFERENCE_DIAGRAMS } from "./reference-diagrams";

const component = (
  id: string,
  parentId: string | null = null,
  type: Component["type"] = "container",
): Component => ({ id, name: id, description: "", parentId, type }) as Component;

const connection = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

const records = <T extends { id: string }>(list: T[]) =>
  Object.fromEntries(list.map((item) => [item.id, item]));

describe("transposition", () => {
  const graph: LayoutGraph = {
    nodes: [
      { id: "p", parentId: null, width: 400, height: 300, topInset: 40 },
      { id: "a", parentId: "p", width: 200, height: 80 },
    ],
    edges: [
      { id: "e", sourceId: "a", targetId: "p", labelBox: { text: "x", width: 60, height: 18 } },
    ],
  };

  it("mirrors sizes, header room and label boxes, and undoes itself", () => {
    const mirrored = transposeGraph(graph);
    expect(mirrored.nodes[0]).toMatchObject({ width: 300, height: 400, leftInset: 40 });
    expect(mirrored.nodes[0]!.topInset).toBeUndefined();
    expect(mirrored.edges[0]!.labelBox).toMatchObject({ width: 18, height: 60 });
    expect(transposeGraph(mirrored)).toEqual(graph);
  });

  it("mirrors a result and undoes itself", async () => {
    const result = await layout(graph);
    expect(transposeResult(transposeResult(result))).toEqual(result);
  });

  it("keeps a header's room on the left of a mirrored container", async () => {
    const result = await layout(transposeGraph(graph));
    expect(result.boxes.get("a")!.x).toBeGreaterThanOrEqual(40);
  });
});

describe("top-to-bottom layout", () => {
  it("lays a chain out downwards", async () => {
    const plan = await planDiagramAutoLayout({
      components: records([component("a"), component("b"), component("c")]),
      connections: [connection("ab", "a", "b"), connection("bc", "b", "c")],
      nodeLayouts: {},
      autoRefs: false,
      direction: "TB",
    });
    const at = Object.fromEntries(plan.layouts.map((entry) => [entry.elementId, entry]));
    expect(at.b!.y).toBeGreaterThan(at.a!.y);
    expect(at.c!.y).toBeGreaterThan(at.b!.y);
    expect(plan.direction).toBe("TB");
  });

  it("keeps every child inside its container on the reference diagrams", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = irToLayoutGraph(ir);
      const result = await inDirection("TB", layout)(graph);
      const present = new Set(graph.nodes.map((node) => node.id));
      for (const node of graph.nodes) {
        if (node.parentId === null || !present.has(node.parentId)) continue;
        const child = result.boxes.get(node.id)!;
        const parent = result.boxes.get(node.parentId)!;
        expect(child.x, `${name}: ${node.id}`).toBeGreaterThanOrEqual(-0.5);
        expect(child.y, `${name}: ${node.id}`).toBeGreaterThanOrEqual(-0.5);
        expect(child.x + child.width, `${name}: ${node.id}`).toBeLessThanOrEqual(
          parent.width + 0.5,
        );
        expect(child.y + child.height, `${name}: ${node.id}`).toBeLessThanOrEqual(
          parent.height + 0.5,
        );
      }
    }
  });

  it("leaves a left-to-right layout exactly as it was", async () => {
    const graph = irToLayoutGraph(REFERENCE_DIAGRAMS[0]!.ir);
    expect(await inDirection("LR", layout)(graph)).toEqual(await layout(graph));
    expect(await inDirection(undefined, layout)(graph)).toEqual(await layout(graph));
  });
});

describe("automatic placement top-to-bottom", () => {
  it("puts a new target one row below its source, and moves nothing else", () => {
    const nodeLayouts: Record<string, NodeLayout> = {
      a: { elementId: "a", x: 100, y: 100, width: 200, height: 80 },
      new: { elementId: "new", x: 900, y: 900, width: 200, height: 80 },
    };
    const placed = placeIncrementally({
      components: records([component("a"), component("new")]),
      connections: records([connection("c", "a", "new")]),
      nodeLayouts,
      dirtyIds: ["new"],
      columnGap: 220,
      rowGap: 40,
      direction: "TB",
    });
    expect(placed).toEqual([{ elementId: "new", x: 100, y: 100 + 80 + 220 }]);
  });
});
