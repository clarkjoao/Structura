import { describe, it, expect } from "vitest";
import { countCrossings } from "./order-rows";
import { stackRows } from "./stack-rows";
import { assignColumns } from "./columns";
import {
  type LayoutNode,
  type LayoutConnection,
  type LayoutState,
  TIER_ORDER,
} from "../types";

function node(id: string, tier: string, overrides: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id,
    type: "system",
    name: id,
    tier: tier as LayoutNode["tier"],
    emphasis: "default",
    width: 200,
    height: 80,
    x: 0,
    y: 0,
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
  return stackRows(assignColumns(state));
}

describe("countCrossings", () => {
  it("is zero for a simple linear flow (no crossings)", () => {
    const state = makeState(
      [
        node("a", "external"),
        node("b", "application"),
        node("c", "data"),
      ],
      [connection("c1", "a", "b"), connection("c2", "b", "c")],
    );
    const laid = layout(state);
    expect(countCrossings(laid)).toBe(0);
  });

  it("detects one crossing when two edges swap order", () => {
    // a1, a2 in "client" tier; b1, b2 in "gateway" tier (adjacent in TIER_ORDER).
    // e1: a1 → b2  (top-to-bottom)
    // e2: a2 → b1  (bottom-to-top)  → these edges cross
    const state = makeState(
      [
        node("a1", "client"),
        node("a2", "client"),
        node("b1", "gateway"),
        node("b2", "gateway"),
      ],
      [connection("e1", "a1", "b2"), connection("e2", "a2", "b1")],
    );
    const laid = layout(state);
    expect(countCrossings(laid)).toBeGreaterThan(0);
  });
});

describe("orderRows", () => {
  it("preserves primary-path relative order", () => {
    const a = node("a", "client");
    const b = node("b", "application");
    const c = node("c", "data");
    const state: LayoutState = {
      ...makeState([a, b, c], [connection("e1", "a", "b"), connection("e2", "b", "c")]),
      primaryPath: ["a", "b", "c"],
    };
    const laid = layout(state);
    const appCol = laid.columns.find((col) => col.tier === "application")!;
    expect(appCol.nodeIds).toContain("b");
    const dataCol = laid.columns.find((col) => col.tier === "data")!;
    expect(dataCol.nodeIds).toContain("c");
    // The path order is preserved (b is the only node in its column; c is the only in its)
    expect(laid.primaryPath).toEqual(["a", "b", "c"]);
  });

  it("keeps boundary members contiguous in the same column", () => {
    // two nodes in the same tier that belong to a boundary must stay together
    const a = node("a", "application");
    const b = node("b", "application");
    const state: LayoutState = {
      ...makeState([a, b], []),
      boundaries: new Map([
        [
          "boundary-1",
          {
            id: "boundary-1",
            name: "Boundary",
            kind: "system",
            contains: ["a", "b"],
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            depth: 0,
          },
        ],
      ]),
    };
    const laid = layout(state);
    const col = laid.columns.find((c) => c.tier === "application")!;
    // both nodes are in the same column
    expect(col.nodeIds).toContain("a");
    expect(col.nodeIds).toContain("b");
    // they are adjacent (contiguous within the boundary)
    const aIdx = col.nodeIds.indexOf("a");
    const bIdx = col.nodeIds.indexOf("b");
    expect(Math.abs(aIdx - bIdx)).toBe(1);
  });

  it("is deterministic — same input always produces the same column order", () => {
    const nodes = Array.from({ length: 6 }, (_, i) =>
      node(`n${i}`, i < 2 ? "client" : i < 4 ? "application" : "data"),
    );
    const connections = [
      connection("e1", "n0", "n3"),
      connection("e2", "n1", "n4"),
      connection("e3", "n2", "n5"),
    ];
    const state = makeState(nodes, connections);

    const run = () => {
      const s = makeState(nodes, connections);
      return layout(s);
    };

    const first = run();
    const firstOrder = first.columns.map((c) => c.nodeIds.join(",")).join("|");

    for (let i = 0; i < 5; i++) {
      const next = run();
      const nextOrder = next.columns.map((c) => c.nodeIds.join(",")).join("|");
      expect(nextOrder).toBe(firstOrder);
    }
  });
});
