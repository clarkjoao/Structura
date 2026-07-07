import { describe, expect, it } from "vitest";
import type { EdgeControlPoint, Point } from "@/features/diagram";
import { buildEditableEdgePath, getPathKnots } from "./paths";
import { getClosestOffsetOnPath, getGhostMidpoints, getPointAtOffset } from "./projection";

const source: Point = { x: 0, y: 0 };
const target: Point = { x: 100, y: 0 };
const cp = (id: string, x: number, y: number): EdgeControlPoint => ({ id, x, y });

describe("getPathKnots", () => {
  it("brackets the control points with source and target", () => {
    const knots = getPathKnots(source, target, [cp("a", 50, 20)]);
    expect(knots).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 20 },
      { x: 100, y: 0 },
    ]);
  });
});

describe("buildEditableEdgePath", () => {
  it("draws a straight line when there are no control points", () => {
    expect(buildEditableEdgePath(source, target, [], "catmull-rom")).toBe("M 0 0 L 100 0");
    expect(buildEditableEdgePath(source, target, [], "linear")).toBe("M 0 0 L 100 0");
  });

  it("emits line segments for linear paths through control points", () => {
    expect(buildEditableEdgePath(source, target, [cp("a", 50, 20)], "linear")).toBe(
      "M 0 0 L 50 20 L 100 0",
    );
  });

  it("emits cubic beziers for catmull-rom paths through control points", () => {
    const d = buildEditableEdgePath(source, target, [cp("a", 50, 20)], "catmull-rom");
    expect(d.startsWith("M 0 0 C")).toBe(true);
    expect(d).toContain("50 20");
    expect(d).toContain("100 0");
  });
});

describe("getPointAtOffset", () => {
  it("returns the midpoint at offset 0.5 on a straight edge", () => {
    expect(getPointAtOffset(source, target, [], 0.5)).toEqual({ x: 50, y: 0 });
  });

  it("clamps out-of-range offsets to the endpoints", () => {
    expect(getPointAtOffset(source, target, [], -1)).toEqual({ x: 0, y: 0 });
    expect(getPointAtOffset(source, target, [], 2)).toEqual({ x: 100, y: 0 });
  });

  it("returns the source for a zero-length edge", () => {
    expect(getPointAtOffset(source, source, [], 0.5)).toEqual({ x: 0, y: 0 });
  });
});

describe("getClosestOffsetOnPath", () => {
  it("projects a point onto the nearest offset along the polyline", () => {
    expect(getClosestOffsetOnPath(source, target, [], { x: 25, y: 10 })).toBeCloseTo(0.25, 5);
  });

  it("falls back to 0.5 on a degenerate edge", () => {
    expect(getClosestOffsetOnPath(source, source, [], { x: 5, y: 5 })).toBe(0.5);
  });
});

describe("getGhostMidpoints", () => {
  it("yields one ghost per segment with the correct insertion index", () => {
    const ghosts = getGhostMidpoints(source, target, [cp("a", 50, 20)]);
    expect(ghosts).toEqual([
      { insertIndex: 0, x: 25, y: 10 },
      { insertIndex: 1, x: 75, y: 10 },
    ]);
  });

  it("yields a single midpoint for a point-less edge", () => {
    expect(getGhostMidpoints(source, target, [])).toEqual([{ insertIndex: 0, x: 50, y: 0 }]);
  });
});
