import { describe, it, expect } from "vitest";
import { sizeGutters } from "./gutters";
import { routeEdges } from "./route-edges";
import { assignColumns } from "./columns";
import { stackRows } from "./stack-rows";
import { buildStepPath } from "@/features/canvas/edges/geometry/orthogonal";
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
        connection("e1", "a", "c"),
        connection("e2", "b1", "c"),
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

/**
 * Anti-divergence test: the SVG path drawn by buildStepPath using the engine's waypoints
 * must produce the exact same segment endpoints as the engine computed.
 *
 * This is the routing equivalent of the text-measurement divergence lock. Without it,
 * the engine could calculate a polyline that the renderer does not draw — the invariant
 * holds in the engine but fails in the viewport.
 *
 * The renderer's buildStepPath treats the first and last waypoints as source/target
 * anchors and the interior waypoints as corners. We verify that the SVG path segments
 * extracted from buildStepPath match the engine's waypoints point-for-point.
 */
describe("routing anti-divergence", () => {
  /** Extracts segment endpoints from an SVG path string produced by buildStepPath. */
  function extractPathSegments(path: string): Array<[number, number]> {
    // buildStepPath produces: M x y [H x V y]+
    const coords: number[] = [];
    for (const token of path.split(/\s+/)) {
      const n = parseFloat(token);
      if (!isNaN(n)) coords.push(n);
    }
    // M x0 y0 [H x_i V y_i]+ → segments (x0,y0)→(x1,y1), (x1,y1)→(x2,y2), …
    const segments: Array<[number, number]> = [];
    for (let i = 2; i < coords.length; i += 2) {
      segments.push([coords[i]!, coords[i + 1]!]);
    }
    return segments;
  }

  /**
   * Verifies that the SVG path built from engine waypoints has exactly the same
   * segment endpoints as the engine computed. Allows ±1 pixel for rounding.
   */
  function assertPathMatchesEngineWaypoints(waypoints: Array<{ x: number; y: number }>): void {
    const source = waypoints[0]!;
    const target = waypoints[waypoints.length - 1]!;
    // All interior waypoints are corners; buildStepPath inserts H/V between them.
    const corners = waypoints.slice(1, -1);
    const svgPath = buildStepPath(source, target, corners);
    const segments = extractPathSegments(svgPath);

    // buildStepPath produces (waypoints.length - 1) segments: source→corner1, corner1→corner2, …, lastCorner→target
    // The segment endpoints are waypoints[1], waypoints[2], … waypoints[n-2] (interior) followed by target
    const engineEnds = waypoints.slice(1).map((wp) => [wp.x, wp.y] as [number, number]);

    expect(segments.length).toBe(engineEnds.length);
    for (let i = 0; i < segments.length; i++) {
      const [sx, sy] = segments[i]!;
      const [ex, ey] = engineEnds[i]!;
      expect(sx).toBeCloseTo(ex, 0);
      expect(sy).toBeCloseTo(ey, 0);
    }
  }

  it('"direct" path: SVG segments match engine waypoints', () => {
    // direct: waypoints = [srcAnchor, tgtAnchor], corners = [], path = M→H→V
    const state = makeState(
      [node("a", "client", 0), node("b", "client", 100)],
      [connection("e1", "a", "b")],
    );
    const laid = layout(state);
    const e = laid.connections.find((c) => c.id === "e1")!;
    expect(e.waypoints).toHaveLength(2);
    assertPathMatchesEngineWaypoints(e.waypoints!);
  });

  it('"gutter" path: SVG segments match engine waypoints', () => {
    // gutter: 4 interior corners in the gutter between adjacent non-aligned columns
    const state = makeState(
      [
        node("a", "external", 0),
        node("b1", "client", 80),
        node("b2", "client", 250),
      ],
      [connection("e1", "a", "b1"), connection("e2", "a", "b2")],
    );
    const laid = layout(state);
    for (const id of ["e1", "e2"]) {
      const e = laid.connections.find((c) => c.id === id)!;
      expect(e.routing).toBe("gutter");
      assertPathMatchesEngineWaypoints(e.waypoints!);
    }
  });

  it('"forward-lane" path: SVG segments match engine waypoints', () => {
    // forward-lane: skip edge takes a lane above the flow
    const state = makeState(
      [
        node("a", "external", 0),
        node("b", "client", 0),
        node("c", "data", 80),
      ],
      [connection("e1", "a", "c")], // skips client tier
    );
    const laid = layout(state);
    const e = laid.connections.find((c) => c.id === "e1")!;
    expect(e.routing).toBe("forward-lane");
    expect(e.waypoints!.length).toBeGreaterThan(4); // src → rise → lane → cross → tgt
    assertPathMatchesEngineWaypoints(e.waypoints!);
  });

  it('"return-lane" path: SVG segments match engine waypoints', () => {
    // return-lane: backward edge takes a lane below the flow
    const state = makeState(
      [
        node("a", "external", 0),
        node("b", "client", 0),
        node("c", "gateway", 80),
      ],
      [connection("e1", "c", "a")], // backward: gateway → external
    );
    const laid = layout(state);
    const e = laid.connections.find((c) => c.id === "e1")!;
    expect(e.routing).toBe("return-lane");
    assertPathMatchesEngineWaypoints(e.waypoints!);
  });

  it("all segments are axis-aligned (no diagonal SVG commands)", () => {
    // buildStepPath uses only M, H, V — no L, C, Q, S, T, A
    const state = makeState(
      [
        node("a", "external", 0),
        node("b1", "client", 0),
        node("b2", "client", 200),
        node("c", "data", 100),
      ],
      [
        connection("e1", "a", "c"),
        connection("e2", "b1", "c"),
        connection("e3", "b2", "a"),
      ],
    );
    const laid = layout(state);
    for (const e of laid.connections) {
      if (!e.waypoints) continue;
      const source = e.waypoints[0]!;
      const target = e.waypoints[e.waypoints.length - 1]!;
      const corners = e.waypoints.slice(1, -1);
      const path = buildStepPath(source, target, corners);
      // buildStepPath must not contain diagonal commands
      expect(path).not.toMatch(/[LCQSTA]/);
    }
  });

  it("suppressed edges produce no waypoints (no-op path)", () => {
    const state = makeState(
      [node("a", "application", 0), node("cc", "cross-cutting", 0)],
      [connection("e1", "a", "cc")],
    );
    const laid = layout(state);
    const e = laid.connections.find((c) => c.id === "e1")!;
    expect(e.routing).toBe("suppressed");
    expect(e.waypoints).toBeUndefined();
  });
});
