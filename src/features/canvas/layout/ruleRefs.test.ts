import { describe, expect, it } from "vitest";
import type { AutoRefPlanOptions } from "./autoRefs";
import type { LayoutBox, LayoutGraph, LayoutResult } from "./contract";
import { columnsOf, planRuleRefs, type RuleRefOptions } from "./ruleRefs";

/**
 * The reading rules over a hand-placed layout: nodes 100 wide, a column every
 * 200, and an unconnected filler in every column nothing else occupies, so
 * `column` is the column count the rules read.
 */

const WIDTH = 100;
const LAYER_GAP = 100;
const col = (n: number) => n * (WIDTH + LAYER_GAP);

interface Placed {
  id: string;
  column: number;
  parentId?: string;
}

function drawing(placed: Placed[], edges: [string, string][], { fill = true } = {}) {
  const used = new Set(placed.map((p) => p.column));
  const last = Math.max(...used);
  const fillers: Placed[] = fill
    ? Array.from({ length: last + 1 }, (_, column) => column)
        .filter((column) => !used.has(column))
        .map((column) => ({ id: `filler${column}`, column }))
    : [];
  placed = [...placed, ...fillers];
  const containers = [
    ...new Set(placed.flatMap((p) => (p.parentId === undefined ? [] : [p.parentId]))),
  ];
  const graph: LayoutGraph = {
    nodes: [
      ...containers.map((id) => ({ id, parentId: null, width: 4000, height: 400 })),
      ...placed.map((p) => ({ id: p.id, parentId: p.parentId ?? null, width: WIDTH, height: 50 })),
    ],
    edges: edges.map(([sourceId, targetId], i) => ({ id: `e${i}`, sourceId, targetId })),
  };
  const result: LayoutResult = {
    // Containers at the origin, so a child's column is its absolute one.
    boxes: new Map<string, LayoutBox>([
      ...containers.map((id): [string, LayoutBox] => [
        id,
        { x: 0, y: 0, width: 4000, height: 400 },
      ]),
      ...placed.map((p, i): [string, LayoutBox] => [
        p.id,
        { x: col(p.column), y: i * 60, width: WIDTH, height: 50 },
      ]),
    ]),
    edgeRoutes: new Map(),
    handleOrder: { outgoing: new Map(), incoming: new Map() },
    bounds: { width: 4000, height: 400 },
  };
  return { graph, result, containers: new Set(containers) };
}

function optionsFor(containers: Set<string>): AutoRefPlanOptions {
  return {
    canReference: (id) => !containers.has(id),
    refParentFor: (parentId) => parentId,
    refIdFor: (originalId, parentId) => `ref:${originalId}:${parentId ?? "root"}`,
    refSize: { width: 100, height: 40 },
  };
}

const RULES: RuleRefOptions = { neighborColumns: 2, minKeep: 1 };

function plan(placed: Placed[], edges: [string, string][], rules: Partial<RuleRefOptions> = {}) {
  const { graph, result, containers } = drawing(placed, edges);
  return planRuleRefs(graph, result, optionsFor(containers), { ...RULES, ...rules });
}

describe("references by reading rules", () => {
  it("counts the columns elements occupy, not the distance between them", () => {
    // Far apart with nothing between: neighbours. Containers do not count.
    const { graph, result } = drawing(
      [
        { id: "a", column: 0, parentId: "p" },
        { id: "a2", column: 0 },
        { id: "b", column: 9 },
      ],
      [],
      { fill: false },
    );
    expect(Object.fromEntries(columnsOf(graph, result))).toEqual({ a: 0, a2: 0, b: 1 });
  });

  it("makes a reference for a connection far back, and leaves a near one and a forward one", () => {
    const result = plan(
      [
        { id: "start", column: 0 },
        { id: "near", column: 4 },
        { id: "a", column: 5 },
        { id: "far", column: 6 },
      ],
      [
        ["start", "a"], // forward
        ["a", "near"], // one column back: a short back-edge
        ["far", "start"], // six columns back
        ["start", "far"],
      ],
    );
    expect(result.groups).toEqual([
      {
        refId: "ref:start:root",
        originalId: "start",
        parentId: null,
        sourceIds: ["far"],
        edgeIds: ["e2"],
      },
    ]);
    expect(result.stats).toEqual({
      backEdges: 2,
      neighborBackEdges: 1,
      movedEdges: 1,
      keptOnOriginal: 0,
      forwardMovedEdges: 0,
      refs: 1,
    });
  });

  it("makes one reference per original and consumer container, not one per connection", () => {
    const result = plan(
      [
        { id: "db", column: 0 },
        { id: "x", column: 5, parentId: "p" },
        { id: "y", column: 6, parentId: "p" },
        { id: "z", column: 7, parentId: "q" },
      ],
      [
        ["x", "db"],
        ["y", "db"],
        ["z", "db"],
        ["db", "x"],
      ],
    );
    const byParent = Object.fromEntries(result.groups.map((g) => [g.parentId, g.sourceIds]));
    expect(byParent).toEqual({ p: ["x", "y"], q: ["z"] });
  });

  it("leaves the closest consumers on an original that would otherwise keep too few", () => {
    const placed = [
      { id: "t", column: 0 },
      { id: "close", column: 4 },
      { id: "mid", column: 6 },
      { id: "away", column: 9 },
    ];
    const edges: [string, string][] = [
      ["close", "t"],
      ["mid", "t"],
      ["away", "t"],
    ];
    // Every connection of `t` is one the rules move: the closest stays.
    const one = plan(placed, edges);
    expect(one.groups.flatMap((g) => g.sourceIds).sort()).toEqual(["away", "mid"]);
    expect(one.stats.keptOnOriginal).toBe(1);
    // Two to keep: the next closest stays too.
    const two = plan(placed, edges, { minKeep: 2 });
    expect(two.groups.flatMap((g) => g.sourceIds)).toEqual(["away"]);
    expect(two.stats.keptOnOriginal).toBe(2);
  });

  it("counts every connection of the original towards what it keeps", () => {
    // `t` has a forward connection of its own, so both back-connections may go.
    const result = plan(
      [
        { id: "t", column: 0 },
        { id: "u", column: 1 },
        { id: "a", column: 5 },
        { id: "b", column: 6 },
      ],
      [
        ["t", "u"],
        ["a", "t"],
        ["b", "t"],
      ],
    );
    expect(result.groups.flatMap((g) => g.sourceIds).sort()).toEqual(["a", "b"]);
    expect(result.stats.keptOnOriginal).toBe(0);
  });

  it("moves long forward connections only when asked", () => {
    const placed = [
      { id: "a", column: 0 },
      { id: "b", column: 8 },
      { id: "c", column: 1 },
    ];
    const edges: [string, string][] = [
      ["a", "b"],
      ["c", "b"],
    ];
    expect(plan(placed, edges).groups).toEqual([]);
    const forward = plan(placed, edges, { forwardColumns: 6 });
    // Both are long; the closer consumer stays so `b` keeps a connection.
    expect(forward.groups.flatMap((g) => g.sourceIds)).toEqual(["a"]);
    expect(forward.stats).toMatchObject({ movedEdges: 0, forwardMovedEdges: 1 });
  });

  it("never references what cannot be referenced", () => {
    const result = plan(
      [
        { id: "a", column: 0, parentId: "p" },
        // Far behind both `a` and the centre of its panel `p`.
        { id: "b", column: 12 },
      ],
      [
        ["b", "p"],
        ["b", "a"],
        ["a", "b"],
      ],
    );
    expect(result.groups.map((g) => g.originalId)).toEqual(["a"]);
  });
});
