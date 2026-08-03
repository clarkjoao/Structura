import { describe, it, expect } from "vitest";
import { sizeGutters } from "./gutters";
import { routeEdges } from "./route-edges";
import { assignColumns } from "./columns";
import { stackRows } from "./stack-rows";
import {
  type LayoutNode,
  type LayoutConnection,
  type LayoutState,
  TIER_ORDER,
} from "../types";

function node(id: string, tier: string, y: number, overrides: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id,
    type: "system",
    name: id,
    tier: tier as LayoutNode["tier"],
    emphasis: "default",
    width: 200,
    height: 80,
    x: 0,
    y,
    ...overrides,
  };
}

function connection(id: string, from: string, to: string): LayoutConnection {
  return { id, from, to, intent: "call", isPrimaryPath: false };
}

function makeState(nodes: LayoutNode[], connections: LayoutConnection[]): LayoutState {
  return {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    boundaries: new Map(),
    connections,
    columns: [],
    tiers: TIER_ORDER,
    density: "medium",
    primaryPath: [],
    gutters: [],
    lanes: { forward: [], return: [] },
    failures: [],
  };
}

function layout(state: LayoutState): LayoutState {
  return routeEdges(sizeGutters(stackRows(assignColumns(state))));
}

describe("sizeGutters", () => {
  it("records the gutter after the first non-cross-cutting column when an edge is misaligned", () => {
    // After layout: nodes in different columns may have different vertical positions.
    // The gutter is placed after whichever column index is smaller between source and target.
    const state = makeState(
      [
        node("a", "external", 0),
        node("b", "client", 0),
        node("c", "gateway", 0),
      ],
      [connection("e1", "a", "c")], // skip edge → lane, not gutter
    );
    const laid = layout(state);
    // Skip edges take lanes, not gutters
    const e = laid.connections.find((c) => c.id === "e1")!;
    expect(e.routing).toBe("forward-lane");
  });

  it("assigns distinct channel positions to multiple crossing edges", () => {
    const state = makeState(
      [
        node("a1", "external", 0),
        node("a2", "external", 80),
        node("a3", "external", 160),
        node("b1", "client", 150),
        node("b2", "client", 250),
        node("b3", "client", 50),
      ],
      [
        connection("e1", "a1", "b1"),
        connection("e2", "a2", "b2"),
        connection("e3", "a3", "b3"),
      ],
    );
    const laid = layout(state);
    const g = laid.gutters[0];
    if (g) {
      expect(g.channelEdgeIds).toHaveLength(3);
      expect(new Set(g.channelEdgeIds).size).toBe(3); // all distinct
    }
  });
});

describe("routeEdges", () => {
  it('sets routing="direct" for same-column connections', () => {
    const state = makeState(
      [node("a", "client", 0), node("b", "client", 100)],
      [connection("e1", "a", "b")],
    );
    const laid = layout(state);
    const e = laid.connections.find((c) => c.id === "e1")!;
    expect(e.routing).toBe("direct");
    expect(e.waypoints).toHaveLength(2);
  });

  it('sets routing="suppressed" when an endpoint is cross-cutting', () => {
    const state = makeState(
      [node("a", "application", 0), node("cc", "cross-cutting", 0)],
      [connection("e1", "a", "cc")],
    );
    const laid = layout(state);
    const e = laid.connections.find((c) => c.id === "e1")!;
    expect(e.routing).toBe("suppressed");
    expect(e.waypoints).toBeUndefined();
  });

  it("assigns distinct lanes to skip edges whose horizontal intervals overlap", () => {
    const state = makeState(
      [
        node("a", "external", 0),
        node("b1", "client", 0),
        node("b2", "gateway", 80),
        node("c", "data", 40),
      ],
      [
        connection("e1", "a", "c"),   // spans external → data
        connection("e2", "b1", "c"), // spans client → data, overlaps e1's extent
      ],
    );
    const laid = layout(state);
    const e1 = laid.connections.find((c) => c.id === "e1")!;
    const e2 = laid.connections.find((c) => c.id === "e2")!;
    expect(e1.routing).toBe("forward-lane");
    expect(e2.routing).toBe("forward-lane");
    expect(e1.waypoints).toBeDefined();
    expect(e2.waypoints).toBeDefined();
  });
});
