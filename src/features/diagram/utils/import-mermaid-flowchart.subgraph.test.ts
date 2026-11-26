import { describe, expect, it } from "vitest";
import type { Component, PanelComponent } from "../model/diagram.types";
import { isPanelComponent } from "../model/component.guards";
import { parseMermaidFlowchart, type FlowchartImportPlan } from "./import-mermaid-flowchart";

const parse = (...lines: string[]): FlowchartImportPlan =>
  parseMermaidFlowchart(["flowchart LR", ...lines].join("\n"), {}, {}, { x: 0, y: 0 });
const named = (plan: FlowchartImportPlan, name: string): Component => {
  const found = plan.newComponents.find((c) => c.name === name);
  if (!found) throw new Error(`no component ${name}`);
  return found;
};
const panels = (plan: FlowchartImportPlan): PanelComponent[] =>
  plan.newComponents.filter(isPanelComponent);
const layoutOf = (plan: FlowchartImportPlan, c: Component) =>
  plan.layouts.find((l) => l.elementId === c.id)!;

describe("parseMermaidFlowchart subgraphs", () => {
  it("maps `subgraph id` to a panel holding its nodes", () => {
    const plan = parse("subgraph Backend", "A[API] --> B[Worker]", "end", "C[User] --> A");
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    const panel = named(plan, "Backend");
    expect(panel.type).toBe("panel");
    expect(named(plan, "API").parentId).toBe(panel.id);
    expect(named(plan, "Worker").parentId).toBe(panel.id);
    expect(named(plan, "User").parentId).toBeNull();
    expect(plan.newConnections).toHaveLength(2);
  });

  it('reads `id [Title]`, `id["Title"]` and `Title with spaces`', () => {
    const plan = parse(
      "subgraph one [First box]",
      "A",
      "end",
      'subgraph two["Second box"]',
      "B",
      "end",
      "subgraph Third box here",
      "C",
      "end",
    );
    expect(plan.errors).toEqual([]);
    expect(panels(plan).map((p) => p.name)).toEqual(["First box", "Second box", "Third box here"]);
    expect(named(plan, "B").parentId).toBe(named(plan, "Second box").id);
  });

  it("nests subgraphs three deep, each panel containing its children", () => {
    const plan = parse(
      "subgraph L1",
      "subgraph L2",
      "subgraph L3",
      "Deep[Deep]",
      "end",
      "Mid[Mid]",
      "end",
      "Top[Top]",
      "end",
    );
    expect(plan.errors).toEqual([]);
    const [l1, l2, l3] = ["L1", "L2", "L3"].map((n) => named(plan, n));
    expect(l1.parentId).toBeNull();
    expect(l2.parentId).toBe(l1.id);
    expect(l3.parentId).toBe(l2.id);
    expect(named(plan, "Deep").parentId).toBe(l3.id);
    expect(named(plan, "Mid").parentId).toBe(l2.id);
    expect(named(plan, "Top").parentId).toBe(l1.id);
    // Layouts are relative to the parent: the child sits inside the parent's box.
    const inside = (child: Component, parent: Component) => {
      const c = layoutOf(plan, child);
      const p = layoutOf(plan, parent);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + (c.width ?? 0)).toBeLessThanOrEqual(p.width ?? 0);
      expect(c.y + (c.height ?? 0)).toBeLessThanOrEqual(p.height ?? 0);
    };
    inside(named(plan, "Deep"), l3);
    inside(l3, l2);
    inside(l2, l1);
    inside(named(plan, "Top"), l1);
  });

  it("ignores `direction` inside a subgraph and says so", () => {
    const plan = parse("subgraph S", "direction TB", "A --> B", "end");
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([{ key: "subgraphDirectionIgnored", params: { count: 1 } }]);
    expect(plan.direction).toBe("LR");
  });

  it("keeps a node mentioned in several subgraphs in the last one", () => {
    const plan = parse("subgraph S1", "A --> B", "end", "subgraph S2", "B --> C", "end");
    expect(named(plan, "B").parentId).toBe(named(plan, "S2").id);
    expect(named(plan, "A").parentId).toBe(named(plan, "S1").id);
    expect(plan.newComponents.filter((c) => c.name === "B")).toHaveLength(1);
  });

  it("does not move a node when an edge outside the subgraph mentions it", () => {
    const plan = parse("subgraph S", "A", "end", "X --> A");
    expect(named(plan, "A").parentId).toBe(named(plan, "S").id);
    expect(named(plan, "X").parentId).toBeNull();
  });

  it("connects edges whose endpoint is a subgraph id to the panel", () => {
    const plan = parse("subgraph S", "A", "end", "U --> S", "S --> V");
    expect(plan.errors).toEqual([]);
    const s = named(plan, "S");
    expect(plan.newComponents.filter((c) => c.name === "S")).toHaveLength(1);
    expect(plan.newConnections.map((c) => [c.sourceId, c.targetId])).toEqual([
      [named(plan, "U").id, s.id],
      [s.id, named(plan, "V").id],
    ]);
  });

  it("resolves an edge to a subgraph declared later", () => {
    const plan = parse("U --> S", "subgraph S", "A", "end");
    expect(plan.errors).toEqual([]);
    expect(plan.newConnections[0]?.targetId).toBe(named(plan, "S").id);
  });

  it("drops an edge between a subgraph and its own contents with a warning", () => {
    const plan = parse("subgraph S", "A", "end", "S --> A");
    expect(plan.newConnections).toEqual([]);
    expect(plan.warnings).toEqual([
      { key: "subgraphEdgeInside", params: { source: "S", target: "A" } },
    ]);
  });

  it("warns on an unclosed subgraph and a stray end, still importing", () => {
    const unclosed = parse("subgraph S", "A --> B");
    expect(unclosed.errors).toEqual([]);
    expect(unclosed.warnings).toEqual([{ key: "subgraphUnclosed", params: { count: 1 } }]);
    expect(named(unclosed, "A").parentId).toBe(named(unclosed, "S").id);
    expect(parse("A --> B", "end").warnings).toEqual([{ key: "subgraphStrayEnd", params: {} }]);
  });

  it("gives an empty subgraph a default-sized panel and rejects a bare `subgraph`", () => {
    const empty = parse("subgraph Empty", "end");
    expect(layoutOf(empty, named(empty, "Empty")).width).toBeGreaterThan(0);
    expect(parse("subgraph").errors).toEqual(["Failed to parse line: subgraph"]);
  });
});
