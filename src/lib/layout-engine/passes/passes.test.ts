import { describe, it, expect } from "vitest";
import { assignColumns } from "./columns";
import { stackColumns, isHubNode } from "./stacking";
import { layoutBoundaries } from "./boundaries";
import { layoutCrossCutting } from "./cross-cutting";
import { snapGeometry } from "./snap";
import { LAYOUT, SPACING } from "../constants";
import {
  TIER_ORDER,
  type LayoutBoundary,
  type LayoutConnection,
  type LayoutNode,
  type LayoutState,
  type Tier,
} from "../types";

function node(id: string, tier: Tier, overrides: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id,
    type: "system",
    name: id,
    tier,
    emphasis: "default",
    width: 200,
    height: 80,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function boundary(
  id: string,
  contains: string[],
  overrides: Partial<LayoutBoundary> = {},
): LayoutBoundary {
  return {
    id,
    name: id,
    kind: "system",
    contains,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    depth: 0,
    ...overrides,
  };
}

function connection(
  id: string,
  from: string,
  to: string,
  overrides: Partial<LayoutConnection> = {},
): LayoutConnection {
  return { id, from, to, intent: "call", isPrimaryPath: false, ...overrides };
}

function state(nodes: LayoutNode[], overrides: Partial<LayoutState> = {}): LayoutState {
  return {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    boundaries: new Map(),
    connections: [],
    columns: [],
    tiers: TIER_ORDER,
    density: "medium",
    primaryPath: [],
    failures: [],
    ...overrides,
  };
}

describe("P1 — assignColumns", () => {
  it("gives each populated tier a column, left to right in tier order", () => {
    const result = assignColumns(
      state([node("a", "external"), node("b", "application"), node("c", "data")]),
    );

    expect(result.columns.map((c) => c.tier)).toEqual(["external", "application", "data"]);
    expect(result.columns[0]!.x).toBeLessThan(result.columns[1]!.x);
    expect(result.columns[1]!.x).toBeLessThan(result.columns[2]!.x);
  });

  it("collapses empty tiers instead of leaving gutters", () => {
    // external and data are populated; everything between them is empty.
    const result = assignColumns(state([node("a", "external"), node("b", "data")]));

    expect(result.columns).toHaveLength(2);
    const gap = result.columns[1]!.x - (result.columns[0]!.x + result.columns[0]!.width);
    expect(gap).toBe(SPACING.medium.colGap);
  });

  it("sizes a column to its widest node", () => {
    const result = assignColumns(
      state([
        node("narrow", "application", { width: 200 }),
        node("wide", "application", { width: 260 }),
      ]),
    );

    expect(result.columns[0]!.width).toBe(260);
  });

  it("centres narrower nodes inside their column", () => {
    const result = assignColumns(
      state([
        node("narrow", "application", { width: 200 }),
        node("wide", "application", { width: 260 }),
      ]),
    );

    const column = result.columns[0]!;
    const narrow = result.nodes.get("narrow")!;
    expect(narrow.x).toBe(column.x + (column.width - narrow.width) / 2);
  });

  it("widens gaps as density increases", () => {
    const nodes = () => [node("a", "external"), node("b", "application")];
    const gapFor = (density: LayoutState["density"]) => {
      const result = assignColumns(state(nodes(), { density }));
      return result.columns[1]!.x - (result.columns[0]!.x + result.columns[0]!.width);
    };

    expect(gapFor("simple")).toBeLessThan(gapFor("medium"));
    expect(gapFor("medium")).toBeLessThan(gapFor("complex"));
  });

  it("does not mutate the input state", () => {
    const input = state([node("a", "external")]);
    const before = input.nodes.get("a")!.x;
    assignColumns(input);
    expect(input.nodes.get("a")!.x).toBe(before);
    expect(input.columns).toHaveLength(0);
  });
});

describe("P2 — stackColumns", () => {
  it("stacks nodes in a column without overlapping", () => {
    const result = stackColumns(
      assignColumns(
        state([node("a", "application"), node("b", "application"), node("c", "application")]),
      ),
    );

    const ys = ["a", "b", "c"].map((id) => result.nodes.get(id)!).sort((p, q) => p.y - q.y);

    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]!.y).toBeGreaterThanOrEqual(ys[i - 1]!.y + ys[i - 1]!.height);
    }
  });

  it("orders primary-path nodes first, in path order", () => {
    const result = stackColumns(
      assignColumns(
        state(
          [node("z", "application"), node("first", "application"), node("second", "application")],
          { primaryPath: ["first", "second"] },
        ),
      ),
    );

    expect(result.nodes.get("first")!.y).toBeLessThan(result.nodes.get("second")!.y);
    expect(result.nodes.get("second")!.y).toBeLessThan(result.nodes.get("z")!.y);
  });

  it("is stable for any input ordering", () => {
    const nodes = [node("c", "application"), node("a", "application"), node("b", "application")];
    const forward = stackColumns(assignColumns(state(nodes)));
    const reversed = stackColumns(assignColumns(state([...nodes].reverse())));

    for (const id of ["a", "b", "c"]) {
      expect(reversed.nodes.get(id)!.y).toBe(forward.nodes.get(id)!.y);
    }
  });

  it("identifies a high-degree async node as a hub", () => {
    const degree = new Map([
      ["bus", { total: 6, async: 6 }],
      ["api", { total: 6, async: 0 }],
      ["small", { total: 2, async: 2 }],
    ]);

    expect(isHubNode("bus", degree)).toBe(true);
    // Plenty of traffic, but synchronous: a busy API is not a bus.
    expect(isHubNode("api", degree)).toBe(false);
    // Async, but not enough traffic to be worth centring.
    expect(isHubNode("small", degree)).toBe(false);
  });

  it("pulls a hub toward the middle of its column", () => {
    const nodes = [
      node("bus", "application"),
      node("s1", "application"),
      node("s2", "application"),
      node("s3", "application"),
      node("s4", "application"),
    ];
    const connections = ["s1", "s2", "s3", "s4"].map((id, i) =>
      connection(`e${i}`, id, "bus", { intent: "event" }),
    );

    const result = stackColumns(assignColumns(state(nodes, { connections })));

    const ordered = [...result.nodes.values()].sort((a, b) => a.y - b.y);
    const hubIndex = ordered.findIndex((n) => n.id === "bus");

    // Not first, not last — somewhere in the middle of the stack.
    expect(hubIndex).toBeGreaterThan(0);
    expect(hubIndex).toBeLessThan(ordered.length - 1);
  });

  it("leaves cross-cutting nodes for P4", () => {
    const result = stackColumns(
      assignColumns(state([node("app", "application"), node("logs", "cross-cutting")])),
    );

    // Untouched by this pass: still at its initial position.
    expect(result.nodes.get("logs")!.y).toBe(0);
  });
});

describe("P3 — layoutBoundaries", () => {
  it("wraps its members with padding and a title band", () => {
    const nodes = [node("a", "application", { x: 100, y: 100 })];
    const boundaries = new Map([["b1", boundary("b1", ["a"])]]);
    const result = layoutBoundaries(state(nodes, { boundaries }));

    const b = result.boundaries.get("b1")!;
    const a = result.nodes.get("a")!;

    expect(b.x).toBe(a.x - LAYOUT.BOUNDARY_PADDING);
    expect(b.y).toBe(a.y - LAYOUT.BOUNDARY_PADDING - LAYOUT.BOUNDARY_TITLE_BAND);
    expect(b.width).toBe(a.width + LAYOUT.BOUNDARY_PADDING * 2);
  });

  it("fully contains every member", () => {
    const nodes = [
      node("a", "application", { x: 100, y: 100 }),
      node("b", "application", { x: 400, y: 300 }),
    ];
    const boundaries = new Map([["b1", boundary("b1", ["a", "b"])]]);
    const result = layoutBoundaries(state(nodes, { boundaries }));

    const b = result.boundaries.get("b1")!;
    for (const id of ["a", "b"]) {
      const n = result.nodes.get(id)!;
      expect(n.x).toBeGreaterThanOrEqual(b.x);
      expect(n.y).toBeGreaterThanOrEqual(b.y);
      expect(n.x + n.width).toBeLessThanOrEqual(b.x + b.width);
      expect(n.y + n.height).toBeLessThanOrEqual(b.y + b.height);
    }
  });

  it("nests an inner boundary inside its parent", () => {
    const nodes = [node("a", "application", { x: 200, y: 200 })];
    const boundaries = new Map([
      ["inner", boundary("inner", ["a"], { parentBoundaryId: "outer" })],
      ["outer", boundary("outer", [])],
    ]);
    const result = layoutBoundaries(state(nodes, { boundaries }));

    const inner = result.boundaries.get("inner")!;
    const outer = result.boundaries.get("outer")!;

    expect(outer.x).toBeLessThanOrEqual(inner.x);
    expect(outer.y).toBeLessThanOrEqual(inner.y);
    expect(outer.x + outer.width).toBeGreaterThanOrEqual(inner.x + inner.width);
    expect(outer.y + outer.height).toBeGreaterThanOrEqual(inner.y + inner.height);
    expect(inner.depth).toBe(1);
    expect(outer.depth).toBe(0);
  });

  it("reflows overlapping siblings downward instead of letting them collide", () => {
    // Both boundaries sit in the same column, so they overlap horizontally.
    const nodes = [
      node("a", "application", { x: 100, y: 100 }),
      node("b", "application", { x: 100, y: 130 }),
    ];
    const boundaries = new Map([
      ["b1", boundary("b1", ["a"], { orderIndex: 0 })],
      ["b2", boundary("b2", ["b"], { orderIndex: 1 })],
    ]);

    const result = layoutBoundaries(state(nodes, { boundaries }));
    const first = result.boundaries.get("b1")!;
    const second = result.boundaries.get("b2")!;

    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  });

  it("moves a boundary's members with it when reflowing", () => {
    const nodes = [
      node("a", "application", { x: 100, y: 100 }),
      node("b", "application", { x: 100, y: 130 }),
    ];
    const boundaries = new Map([
      ["b1", boundary("b1", ["a"], { orderIndex: 0 })],
      ["b2", boundary("b2", ["b"], { orderIndex: 1 })],
    ]);

    const result = layoutBoundaries(state(nodes, { boundaries }));
    const second = result.boundaries.get("b2")!;
    const member = result.nodes.get("b")!;

    // The member must still sit inside its boundary after the shift.
    expect(member.y).toBeGreaterThanOrEqual(second.y);
    expect(member.y + member.height).toBeLessThanOrEqual(second.y + second.height);
  });

  it("leaves horizontally separated siblings alone", () => {
    const nodes = [node("a", "external", { x: 0, y: 100 }), node("b", "data", { x: 900, y: 100 })];
    const boundaries = new Map([
      ["b1", boundary("b1", ["a"], { orderIndex: 0 })],
      ["b2", boundary("b2", ["b"], { orderIndex: 1 })],
    ]);

    const result = layoutBoundaries(state(nodes, { boundaries }));
    // Side-by-side boundaries must not be stacked for no reason.
    expect(result.boundaries.get("b2")!.y).toBe(result.boundaries.get("b1")!.y);
  });

  it("survives a boundary cycle without recursing forever", () => {
    const boundaries = new Map([
      ["b1", boundary("b1", [], { parentBoundaryId: "b2" })],
      ["b2", boundary("b2", [], { parentBoundaryId: "b1" })],
    ]);

    // The validators report the cycle; the engine must not hang on it.
    expect(() => layoutBoundaries(state([], { boundaries }))).not.toThrow();
  });
});

describe("P4 — layoutCrossCutting", () => {
  it("places the band below the main flow", () => {
    const nodes = [node("app", "application"), node("logs", "cross-cutting")];
    const laid = stackColumns(assignColumns(state(nodes)));
    const result = layoutCrossCutting(laid);

    const app = result.nodes.get("app")!;
    const logs = result.nodes.get("logs")!;

    expect(logs.y).toBeGreaterThanOrEqual(app.y + app.height + LAYOUT.CROSS_CUTTING_GAP);
  });

  it("wraps into rows of at most CROSS_CUTTING_PER_ROW", () => {
    const nodes = [node("app", "application")];
    for (let i = 0; i < LAYOUT.CROSS_CUTTING_PER_ROW + 3; i += 1) {
      nodes.push(node(`cc${i}`, "cross-cutting"));
    }

    const result = layoutCrossCutting(stackColumns(assignColumns(state(nodes))));
    const band = [...result.nodes.values()].filter((n) => n.tier === "cross-cutting");
    const rows = new Set(band.map((n) => n.y));

    expect(rows.size).toBeGreaterThan(1);
  });

  it("leaves no overlaps in the band", () => {
    const nodes = [node("app", "application")];
    for (let i = 0; i < 12; i += 1) nodes.push(node(`cc${i}`, "cross-cutting"));

    const result = layoutCrossCutting(stackColumns(assignColumns(state(nodes))));
    const band = [...result.nodes.values()].filter((n) => n.tier === "cross-cutting");

    for (let i = 0; i < band.length; i += 1) {
      for (let j = i + 1; j < band.length; j += 1) {
        const a = band[i]!;
        const b = band[j]!;
        const overlaps =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("clears boundaries too, not just loose nodes", () => {
    const nodes = [node("app", "application", { x: 0, y: 0 }), node("logs", "cross-cutting")];
    const boundaries = new Map([["b1", boundary("b1", ["app"])]]);
    const laid = layoutBoundaries(stackColumns(assignColumns(state(nodes, { boundaries }))));
    const result = layoutCrossCutting(laid);

    const b = result.boundaries.get("b1")!;
    expect(result.nodes.get("logs")!.y).toBeGreaterThanOrEqual(b.y + b.height);
  });

  it("does nothing when there are no cross-cutting nodes", () => {
    const input = stackColumns(assignColumns(state([node("app", "application")])));
    const result = layoutCrossCutting(input);
    expect(result.nodes.get("app")!.y).toBe(input.nodes.get("app")!.y);
  });
});

describe("P6 — snapGeometry", () => {
  it("snaps node positions to the grid", () => {
    const result = snapGeometry(state([node("a", "application", { x: 123, y: 457 })]));
    const a = result.nodes.get("a")!;

    expect(a.x % LAYOUT.GRID).toBe(0);
    expect(a.y % LAYOUT.GRID).toBe(0);
  });

  it("leaves measured node sizes untouched", () => {
    // Sizes come from measurement and must keep matching what the browser renders.
    const result = snapGeometry(state([node("a", "application", { width: 247, height: 83 })]));
    const a = result.nodes.get("a")!;

    expect(a.width).toBe(247);
    expect(a.height).toBe(83);
  });

  it("never shrinks a boundary below the content it encloses", () => {
    const nodes = [node("a", "application", { x: 103, y: 107 })];
    const boundaries = new Map([["b1", boundary("b1", ["a"])]]);
    const laid = layoutBoundaries(state(nodes, { boundaries }));
    const result = snapGeometry(laid);

    const before = laid.boundaries.get("b1")!;
    const after = result.boundaries.get("b1")!;

    expect(after.x + after.width).toBeGreaterThanOrEqual(before.x + before.width);
    expect(after.y + after.height).toBeGreaterThanOrEqual(before.y + before.height);
  });

  it("is idempotent", () => {
    const once = snapGeometry(state([node("a", "application", { x: 123, y: 457 })]));
    const twice = snapGeometry(once);

    expect(twice.nodes.get("a")!.x).toBe(once.nodes.get("a")!.x);
    expect(twice.nodes.get("a")!.y).toBe(once.nodes.get("a")!.y);
  });
});
