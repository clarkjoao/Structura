import { describe, expect, it } from "vitest";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { layout } from "./layoutEngine";
import { fromDiagram } from "./fromDiagram";
import type { LayoutGraph, LayoutResult } from "./contract";
import { handPlacedDiagram } from "./hand-placed-diagram";
import { REFERENCE_DIAGRAMS } from "./reference-diagrams";

/**
 * The behaviour this project asks of its layout, stated as numbers rather than
 * as structure. Each of these reproduces a defect the previous engine shipped:
 * children left outside their own panel, a left-to-right chain broken into rows,
 * nodes silently dropped, and a result that depended on the order the input
 * happened to be in.
 */

const component = (
  id: string,
  parentId: string | null,
  type: Component["type"] = "container",
): Component => ({ id, name: id, description: "", parentId, type }) as Component;

const connection = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

function componentsOf(list: Component[]): Record<string, Component> {
  return Object.fromEntries(list.map((c) => [c.id, c]));
}

/**
 * Children whose box escapes the parent that owns it.
 *
 * Boxes are parent-relative, so a child is inside when it starts at or after the
 * parent's origin and ends at or before the parent's extent.
 */
function childrenOutsideParent(graph: LayoutGraph, result: LayoutResult): string[] {
  const present = new Set(graph.nodes.map((node) => node.id));
  const escaped: string[] = [];

  for (const node of graph.nodes) {
    const parentId = node.parentId;
    if (parentId === null || !present.has(parentId)) continue;

    const child = result.boxes.get(node.id);
    const parent = result.boxes.get(parentId);
    if (!child || !parent) continue;

    const inside =
      child.x >= -0.5 &&
      child.y >= -0.5 &&
      child.x + child.width <= parent.width + 0.5 &&
      child.y + child.height <= parent.height + 0.5;
    if (!inside) escaped.push(node.id);
  }

  return escaped;
}

/** The hand-placed fixture as engine input: flat, with edges against the flow. */
function handPlacedGraph(): LayoutGraph {
  const diagram = handPlacedDiagram();
  const nodes = [...diagram.boxes]
    .filter(([id]) => id !== diagram.rootId)
    .map(([id, box]) => ({ id, parentId: null, width: box.width, height: box.height }));
  return { nodes, edges: diagram.edges };
}

/**
 * A reference diagram as the canvas holds it: components with a stored panel
 * size. This is the shape the overflow defect lived in — a panel pinned at
 * 600x400 while its children were placed as though it were three times wider —
 * so the containment guard has to cover this path, not only the IR one.
 */
function referenceAsDiagram(ir: (typeof REFERENCE_DIAGRAMS)[number]["ir"]): {
  components: Record<string, Component>;
  connections: Connection[];
  nodeLayouts: Record<string, NodeLayout>;
} {
  const parents = new Set(
    ir.nodes.map((node) => node.parentId).filter((id): id is string => id !== null),
  );

  const components: Record<string, Component> = {};
  const nodeLayouts: Record<string, NodeLayout> = {};
  for (const node of ir.nodes) {
    const isPanel = parents.has(node.id);
    components[node.id] = component(node.id, node.parentId, isPanel ? "panel" : "container");
    nodeLayouts[node.id] = isPanel
      ? { elementId: node.id, x: 0, y: 0, width: 600, height: 400 }
      : { elementId: node.id, x: 0, y: 0, width: 180, height: 80 };
  }

  const connections = ir.edges.map((edge) => connection(edge.id, edge.sourceId, edge.targetId));
  return { components, connections, nodeLayouts };
}

describe("layout — a child never leaves its parent", () => {
  it("keeps every child inside its parent box, on all four reference diagrams", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = irToLayoutGraph(ir);
      const escaped = childrenOutsideParent(graph, await layout(graph));
      expect(escaped, `${name}: ${escaped.join(", ")} outside their parent`).toEqual([]);
    }
  });

  it("keeps every child inside its parent box on the diagram path, whatever the stored panel size", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const { components, connections, nodeLayouts } = referenceAsDiagram(ir);
      const graph = fromDiagram(components, connections, nodeLayouts);
      const escaped = childrenOutsideParent(graph, await layout(graph));
      expect(escaped, `${name}: ${escaped.join(", ")} outside their parent`).toEqual([]);
    }
  });

  it("keeps every child inside its parent box, on the hand-placed fixture", async () => {
    const graph = handPlacedGraph();
    const escaped = childrenOutsideParent(graph, await layout(graph));
    expect(escaped).toEqual([]);
  });

  it("grows a container past the size it was handed, when its children need it", async () => {
    // Five 180px leaves in a row cannot fit a 240px seed; the box that comes back
    // has to be the fitted one, not the one that went in.
    const graph: LayoutGraph = {
      nodes: [
        { id: "panel", parentId: null, width: 240, height: 160 },
        ...["c1", "c2", "c3", "c4", "c5"].map((id) => ({
          id,
          parentId: "panel",
          width: 180,
          height: 80,
        })),
      ],
      edges: [
        { id: "e1", sourceId: "c1", targetId: "c2" },
        { id: "e2", sourceId: "c2", targetId: "c3" },
        { id: "e3", sourceId: "c3", targetId: "c4" },
        { id: "e4", sourceId: "c4", targetId: "c5" },
      ],
    };
    const result = await layout(graph);
    expect(result.boxes.get("panel")!.width).toBeGreaterThan(240);
    expect(childrenOutsideParent(graph, result)).toEqual([]);
  });
});

describe("layout — a chain reads left to right", () => {
  it("puts a linear chain of five in a single row", async () => {
    const ids = ["a", "b", "c", "d", "e"];
    const graph: LayoutGraph = {
      nodes: ids.map((id) => ({ id, parentId: null, width: 180, height: 80 })),
      edges: ids.slice(1).map((id, index) => ({
        id: `e${index}`,
        sourceId: ids[index],
        targetId: id,
      })),
    };

    const result = await layout(graph);
    const boxes = ids.map((id) => result.boxes.get(id)!);

    const rows = new Set(boxes.map((box) => Math.round(box.y)));
    expect(rows.size, `chain wrapped into ${rows.size} rows`).toBe(1);

    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i].x, `${ids[i]} must sit right of ${ids[i - 1]}`).toBeGreaterThan(
        boxes[i - 1].x,
      );
    }
  });

  it("keeps a chain of eight in a single row too", async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `n${i}`);
    const graph: LayoutGraph = {
      nodes: ids.map((id) => ({ id, parentId: null, width: 180, height: 80 })),
      edges: ids.slice(1).map((id, index) => ({
        id: `e${index}`,
        sourceId: ids[index],
        targetId: id,
      })),
    };
    const result = await layout(graph);
    const rows = new Set(ids.map((id) => Math.round(result.boxes.get(id)!.y)));
    expect(rows.size, `chain wrapped into ${rows.size} rows`).toBe(1);
  });
});

describe("layout — nothing is silently dropped", () => {
  it("lays out components with no connections, and notes", async () => {
    const components = componentsOf([
      component("a", null),
      component("b", null),
      component("lonely", null),
      component("note", null, "note"),
    ]);
    const connections = [connection("e1", "a", "b")];

    const graph = fromDiagram(components, connections, {});
    const result = await layout(graph);

    expect([...result.boxes.keys()].sort()).toEqual(["a", "b", "lonely", "note"]);
  });

  it("lays out a diagram that has no connections at all", async () => {
    const components = componentsOf([component("a", null), component("b", null)]);

    const graph = fromDiagram(components, [], {});
    const result = await layout(graph);

    expect(result.boxes.size).toBe(2);
    expect(result.bounds.width).toBeGreaterThan(0);
    expect(result.bounds.height).toBeGreaterThan(0);
  });

  it("keeps a note that is nested inside a panel", async () => {
    const components = componentsOf([
      component("panel", null, "panel"),
      component("a", "panel"),
      component("note", "panel", "note"),
    ]);

    const graph = fromDiagram(components, [], {});
    const result = await layout(graph);

    expect(result.boxes.has("note")).toBe(true);
    expect(childrenOutsideParent(graph, result)).toEqual([]);
  });
});

describe("layout — input order is not information", () => {
  /** Deterministic permutations: reversed, and rotated by a third. */
  function permutations(graph: LayoutGraph): LayoutGraph[] {
    const rotate = <T>(items: T[]): T[] => {
      const pivot = Math.floor(items.length / 3);
      return [...items.slice(pivot), ...items.slice(0, pivot)];
    };
    return [
      { nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() },
      { nodes: rotate(graph.nodes), edges: rotate(graph.edges) },
    ];
  }

  it("produces identical geometry however the reference diagrams are ordered", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = irToLayoutGraph(ir);
      const expected = await layout(graph);

      for (const [index, permuted] of permutations(graph).entries()) {
        const actual = await layout(permuted);
        for (const [id, box] of expected.boxes) {
          expect(actual.boxes.get(id), `${name} permutation ${index}, node ${id}`).toEqual(box);
        }
        expect(actual.bounds, `${name} permutation ${index} bounds`).toEqual(expected.bounds);
      }
    }
  });

  it("produces identical geometry however a Record enumerates", async () => {
    const list = [
      component("panel", null, "panel"),
      component("a", "panel"),
      component("b", "panel"),
      component("c", "panel"),
      component("outside", null),
    ];
    const connections = [
      connection("e1", "outside", "a"),
      connection("e2", "a", "b"),
      connection("e3", "b", "c"),
      connection("e4", "a", "c"),
    ];
    const nodeLayouts: Record<string, NodeLayout> = {};

    const forward = await layout(fromDiagram(componentsOf(list), connections, nodeLayouts));
    const backward = await layout(
      fromDiagram(componentsOf([...list].reverse()), [...connections].reverse(), nodeLayouts),
    );

    expect([...backward.boxes.entries()].sort()).toEqual([...forward.boxes.entries()].sort());
  });
});

describe("layout — scope", () => {
  it("treats a parent outside the graph as a root", async () => {
    const components = componentsOf([
      component("panel", null, "panel"),
      component("a", "panel"),
      component("b", "panel"),
      component("elsewhere", null),
    ]);
    const connections = [connection("e1", "a", "b")];

    // Only the panel's children, not the panel: they have to lay out as roots.
    const graph = fromDiagram(components, connections, {}, { rootIds: ["a", "b"] });
    const result = await layout(graph);

    expect([...result.boxes.keys()].sort()).toEqual(["a", "b"]);
    expect(result.boxes.get("a")!.x).toBeLessThan(result.boxes.get("b")!.x);
  });

  it("pulls in every descendant of a requested root", async () => {
    const components = componentsOf([
      component("panel", null, "panel"),
      component("inner", "panel", "panel"),
      component("leaf", "inner"),
      component("elsewhere", null),
    ]);

    const graph = fromDiagram(components, [], {}, { rootIds: ["panel"] });

    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["inner", "leaf", "panel"]);
  });
});
