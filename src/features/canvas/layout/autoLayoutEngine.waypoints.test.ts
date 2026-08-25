import { describe, expect, it } from "vitest";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { computeAutoLayout } from "./autoLayoutEngine";

/**
 * ELK reports an edge's geometry relative to the lowest common ancestor of its
 * endpoints, not to the node whose `edges` array holds it. `useAutoLayout`
 * writes those bend points into the store as absolute canvas control points, so
 * an edge between two siblings inside a panel used to land offset by that
 * panel's absolute position — the deeper the nesting, the further off.
 *
 * Before the fix, the edge below came back with a bend at x≈356 while the two
 * nodes it joins sit at x≈716 and x≈932: the panel offset (≈468) was missing.
 */

const panel = (id: string, parentId: string | null = null): Component =>
  ({ id, name: id, description: "", parentId, type: "panel" }) as Component;

const node = (id: string, parentId: string | null): Component =>
  ({ id, name: id, description: "", parentId, type: "system" }) as Component;

const layout = (elementId: string, x: number, y: number, width = 180, height = 80): NodeLayout => ({
  elementId,
  x,
  y,
  width,
  height,
});

const connection = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

/**
 * Siblings two panels deep, with a fan-out that forces ELK to bend the edge.
 * `outside` keeps a top-level edge in the same run for contrast.
 */
function nestedScenario() {
  const components: Record<string, Component> = {
    outer: panel("outer"),
    inner: panel("inner", "outer"),
    a: node("a", "inner"),
    b: node("b", "inner"),
    d: node("d", "inner"),
    outside: node("outside", null),
  };
  const nodeLayouts: Record<string, NodeLayout> = {
    outer: layout("outer", 900, 500, 900, 500),
    inner: layout("inner", 60, 60, 700, 340),
    a: layout("a", 40, 40),
    b: layout("b", 400, 40),
    d: layout("d", 400, 200),
    outside: layout("outside", 100, 100),
  };
  const connections = [
    connection("a-b", "a", "b"),
    connection("a-d", "a", "d"),
    connection("out-a", "outside", "a"),
  ];
  return { components, nodeLayouts, connections };
}

/** Positions come back parent-relative, like the store holds them. */
function absolutePositions(
  positions: Array<{ elementId: string; x: number; y: number }>,
  components: Record<string, Component>,
): Map<string, { x: number; y: number }> {
  const relative = new Map(positions.map((position) => [position.elementId, position]));
  const absolute = new Map<string, { x: number; y: number }>();
  for (const { elementId } of positions) {
    let x = 0;
    let y = 0;
    let current: string | null | undefined = elementId;
    while (current) {
      const position = relative.get(current);
      if (!position) break;
      x += position.x;
      y += position.y;
      current = components[current]?.parentId ?? null;
    }
    absolute.set(elementId, { x, y });
  }
  return absolute;
}

describe("computeAutoLayout — edge waypoints", () => {
  it("puts a nested edge's waypoints in absolute space, not the panel's", async () => {
    const { components, nodeLayouts, connections } = nestedScenario();
    const result = await computeAutoLayout(components, connections, nodeLayouts);

    const waypoints = result.edgeWaypoints.get("a-d");
    expect(waypoints, "expected ELK to bend this edge").toBeDefined();
    expect(waypoints!.length).toBeGreaterThan(0);

    const absolute = absolutePositions(result.positions, components);
    const source = absolute.get("a")!;
    const target = absolute.get("d")!;
    const width = nodeLayouts.a.width ?? 180;

    // The bend has to sit in the corridor between the two nodes. Panel-relative
    // values land hundreds of pixels to the left of it.
    const minX = Math.min(source.x, target.x) - 1;
    const maxX = Math.max(source.x + width, target.x + width) + 1;

    for (const point of waypoints!) {
      expect(point.x, "waypoint x is in the corridor between the nodes").to.be.within(minX, maxX);
    }
  });

  it("leaves a top-level edge's waypoints where they already were", async () => {
    const { components, nodeLayouts, connections } = nestedScenario();
    const result = await computeAutoLayout(components, connections, nodeLayouts);
    const waypoints = result.edgeWaypoints.get("out-a");
    if (!waypoints?.length) return;

    const absolute = absolutePositions(result.positions, components);
    const source = absolute.get("outside")!;
    const target = absolute.get("a")!;
    for (const point of waypoints) {
      expect(point.x).to.be.within(
        Math.min(source.x, target.x) - 1,
        Math.max(source.x, target.x) + 400,
      );
    }
  });

  it("still lays the graph out and reports every connection", async () => {
    const { components, nodeLayouts, connections } = nestedScenario();
    const result = await computeAutoLayout(components, connections, nodeLayouts);
    expect(result.laidOutConnectionIds).toEqual(expect.arrayContaining(["a-b", "a-d", "out-a"]));
    expect(result.positions.length).toBe(Object.keys(components).length);
  });
});

/**
 * The sharp version of the same claim: one panel driven far from the origin,
 * two children, one bending edge. If the lowest-common-ancestor offset were
 * ever dropped, the bend would come back in panel-relative coordinates — small
 * numbers, sitting outside the panel's absolute box entirely.
 *
 * ELK discards the input positions, so the panel is pushed away from the origin
 * the only way that works: a wide upstream node it depends on, which forces it
 * into a later layer.
 */
describe("computeAutoLayout — waypoints carry the panel offset", () => {
  it("puts a sibling edge's bend inside the panel's absolute box", async () => {
    const components: Record<string, Component> = {
      outer: panel("outer"),
      entry: node("entry", "outer"),
      p: panel("p", "outer"),
      a: node("a", "p"),
      b: node("b", "p"),
      c: node("c", "p"),
    };
    const nodeLayouts: Record<string, NodeLayout> = {
      outer: layout("outer", 0, 0, 1800, 900),
      entry: layout("entry", 40, 40, 600, 120),
      p: layout("p", 800, 600, 900, 500),
      a: layout("a", 40, 40),
      b: layout("b", 400, 40),
      c: layout("c", 400, 240),
    };
    const connections = [
      connection("entry-a", "entry", "a"),
      connection("a-b", "a", "b"),
      connection("a-c", "a", "c"),
    ];

    const result = await computeAutoLayout(components, connections, nodeLayouts);

    const waypoints = result.edgeWaypoints.get("a-c");
    expect(waypoints, "expected ELK to bend this edge").toBeDefined();
    expect(waypoints!.length, "expected at least one bend point").toBeGreaterThan(0);

    const absolute = absolutePositions(result.positions, components);
    const p = absolute.get("p")!;
    const a = absolute.get("a")!;
    const c = absolute.get("c")!;

    // Without a real offset there is nothing for this test to catch: a bend read
    // in panel-relative space would still land near the panel.
    expect(p.x, "panel must sit far from the origin for this to bite").toBeGreaterThan(400);

    // The bend belongs in the corridor its own two nodes define, in absolute
    // space. Panel-relative values fall hundreds of pixels short of `a.x`.
    const width = nodeLayouts.a.width ?? 180;
    for (const point of waypoints!) {
      expect(point.x, "bend x is at or past the source node").toBeGreaterThanOrEqual(a.x);
      expect(point.x, "bend x is not past the target node").toBeLessThanOrEqual(c.x + width);
      expect(point.y, "bend y is at or past the panel top").toBeGreaterThanOrEqual(p.y);
    }
  });
});
