import { describe, expect, it } from "vitest";
import type { ElkNode } from "elkjs";
import { readElkHandleOrder } from "./elkHandleOrder";
import { layoutIRGraph } from "./irLayoutEngine";
import type { DiagramIR } from "@/features/llm/ir/ir.types";

function edge(id: string, source: string, target: string, start: number[], end: number[]) {
  return {
    id,
    sources: [source],
    targets: [target],
    sections: [
      {
        id: `${id}-s`,
        startPoint: { x: start[0], y: start[1] },
        endPoint: { x: end[0], y: end[1] },
      },
    ],
  };
}

const leaf = (id: string, x: number, y: number): ElkNode => ({ id, x, y, width: 100, height: 50 });

describe("readElkHandleOrder", () => {
  it("orders a node's outgoing edges top to bottom by attachment height", () => {
    const graph: ElkNode = {
      id: "root",
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      children: [leaf("hub", 0, 100), leaf("a", 400, 0), leaf("b", 400, 200)],
      edges: [
        // Declared b-first, but attached lower than the edge to `a`.
        edge("to-b", "hub", "b", [100, 140], [400, 225]),
        edge("to-a", "hub", "a", [100, 110], [400, 25]),
      ],
    };

    expect(readElkHandleOrder(graph).outgoing.get("hub")).toEqual(["to-a", "to-b"]);
  });

  it("orders incoming edges by where they land", () => {
    const graph: ElkNode = {
      id: "root",
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      children: [leaf("x", 0, 0), leaf("y", 0, 200), leaf("sink", 400, 100)],
      edges: [
        edge("from-y", "y", "sink", [100, 225], [400, 140]),
        edge("from-x", "x", "sink", [100, 25], [400, 110]),
      ],
    };

    expect(readElkHandleOrder(graph).incoming.get("sink")).toEqual(["from-x", "from-y"]);
  });

  it("is deterministic when two edges attach at the same height", () => {
    const graph: ElkNode = {
      id: "root",
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      children: [leaf("hub", 0, 0), leaf("a", 400, 0), leaf("b", 400, 100)],
      edges: [
        edge("second", "hub", "b", [100, 25], [400, 125]),
        edge("first", "hub", "a", [100, 25], [400, 25]),
      ],
    };

    const once = readElkHandleOrder(graph).outgoing.get("hub");
    const twice = readElkHandleOrder(graph).outgoing.get("hub");
    expect(once).toEqual(twice);
    expect(once).toEqual(["first", "second"]);
  });

  it("returns nothing for a graph with no edges", () => {
    const order = readElkHandleOrder({
      id: "root",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      children: [leaf("a", 0, 0)],
    });
    expect(order.outgoing.size).toBe(0);
    expect(order.incoming.size).toBe(0);
  });
});

describe("readElkHandleOrder — against a real ELK run", () => {
  /**
   * A hub fanning out to five targets is the shape that produced 17 rendered
   * crossings with round-robin handles. ELK sorts its attachments to match the
   * vertical order of the targets; this asserts that ordering survives the read.
   */
  it("recovers an order that matches the vertical order of the targets", async () => {
    const ir: DiagramIR = {
      type: "c4-context",
      nodes: [
        { id: "hub", semanticType: "container", name: "Hub", parentId: null, tier: "compute" },
        ...["a", "b", "c", "d", "e"].map((id) => ({
          id,
          semanticType: "external-system" as const,
          name: id.toUpperCase(),
          parentId: null,
          tier: "integration" as const,
        })),
      ],
      edges: ["a", "b", "c", "d", "e"].map((id) => ({
        id: `to-${id}`,
        sourceId: "hub",
        targetId: id,
      })),
    };

    const graph = await layoutIRGraph(ir);
    const order = readElkHandleOrder(graph).outgoing.get("hub");
    expect(order).toHaveLength(5);

    // Targets, sorted by their own vertical position, must appear in the same
    // sequence as the attachments they hang off.
    const boxes = new Map<string, number>();
    const walk = (node: ElkNode, oy = 0): void => {
      const y = oy + (node.y ?? 0);
      boxes.set(node.id, y);
      for (const child of node.children ?? []) walk(child, y);
    };
    walk(graph);

    const targetsByHeight = ["a", "b", "c", "d", "e"]
      .slice()
      .sort((first, second) => (boxes.get(first) ?? 0) - (boxes.get(second) ?? 0))
      .map((id) => `to-${id}`);

    expect(order).toEqual(targetsByHeight);
  });
});
