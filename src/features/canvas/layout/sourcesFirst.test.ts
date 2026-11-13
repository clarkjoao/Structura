import { describe, expect, it } from "vitest";
import { useDiagramStore } from "@/features/diagram";
import type { LayoutGraph } from "./contract";
import { planDiagramAutoLayout } from "./autoLayoutDiagram";
import { columnsOf } from "./ruleRefs";
import { withSourcesFirst } from "./sourcesFirst";

/**
 * An element no connection enters starts its container's reading: the diagram
 * grows from it, along the reading, never back from it.
 */

const node = (id: string, parentId: string | null = null) => ({
  id,
  parentId,
  width: 100,
  height: 50,
});

function pinned(graph: LayoutGraph) {
  return withSourcesFirst(graph)
    .nodes.filter((n) => n.firstLayer)
    .map((n) => n.id)
    .sort();
}

describe("withSourcesFirst", () => {
  it("pins what nothing enters, the unconnected included, and nothing else", () => {
    const graph: LayoutGraph = {
      nodes: [node("a"), node("b"), node("c"), node("alone"), node("loop")],
      edges: [
        { id: "e1", sourceId: "a", targetId: "b" },
        { id: "e2", sourceId: "b", targetId: "c" },
        { id: "e3", sourceId: "loop", targetId: "loop" },
      ],
    };
    expect(pinned(graph)).toEqual(["a", "alone", "loop"]);
  });

  it("counts a container entered when a connection reaches inside it from outside", () => {
    const graph: LayoutGraph = {
      nodes: [node("p"), node("q"), node("p1", "p"), node("p2", "p"), node("q1", "q")],
      edges: [
        // Inside p: p1 starts it.
        { id: "e1", sourceId: "p1", targetId: "p2" },
        // From p into q: q is entered, p is not.
        { id: "e2", sourceId: "p2", targetId: "q1" },
      ],
    };
    expect(pinned(graph)).toEqual(["p", "p1"]);
  });
});

describe("the whole-diagram arrangement", () => {
  it("starts a source in the first column, though its one connection goes far ahead", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Sources first", "container");
    store.openDiagram(diagram.id);
    const add = (name: string) => useDiagramStore.getState().addComponent("system", name, null).id;
    const chain = ["A", "B", "C", "D"].map(add);
    for (let i = 0; i < chain.length - 1; i += 1) {
      useDiagramStore.getState().addConnection(chain[i]!, chain[i + 1]!, "");
    }
    // Left to itself, ELK would put S right before D, two columns in.
    const late = add("S");
    useDiagramStore.getState().addConnection(late, chain[3]!, "");

    const state = useDiagramStore.getState();
    const current = state.diagrams[state.activeDiagramId!]!;
    const plan = await planDiagramAutoLayout({
      components: current.snapshot.components,
      connections: Object.values(current.snapshot.connections),
      nodeLayouts: current.nodeLayouts,
      autoRefs: true,
    });
    const columns = columnsOf(plan.graph, plan.result);
    expect(columns.get(late)).toBe(0);
    expect(columns.get(chain[0]!)).toBe(0);
  });
});
