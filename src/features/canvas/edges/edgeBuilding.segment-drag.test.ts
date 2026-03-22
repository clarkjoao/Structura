import { describe, expect, it } from "vitest";
import {
  buildSegments,
  computeSegmentDrag,
  getClosestOffsetOnPath,
  getPointAtOffset,
} from "./edgeBuilding";

describe("buildSegments", () => {
  it("returns one segment between source and target when there are no waypoints", () => {
    const segments = buildSegments(0, 0, 100, 50, []);
    expect(segments).toHaveLength(1);
    expect(segments[0].index).toBe(0);
    expect(segments[0].orientation).toBe("horizontal");
  });
});

describe("computeSegmentDrag", () => {
  it("creates two horizontal waypoints when dragging the only segment with no prior waypoints", () => {
    const segments = buildSegments(0, 0, 100, 40, []);
    const seg = segments[0];
    expect(seg).toBeDefined();
    const next = computeSegmentDrag(0, 0, 100, 40, [], seg!, { x: 0, y: 10 });
    expect(next).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
    ]);
  });

  it("updates both interior waypoints on a middle horizontal segment", () => {
    const waypoints = [
      { x: 20, y: 0 },
      { x: 80, y: 0 },
    ];
    const segments = buildSegments(0, 0, 100, 100, waypoints);
    const middle = segments.find((s) => s.index === 1 && s.orientation === "horizontal");
    expect(middle).toBeDefined();
    const next = computeSegmentDrag(0, 0, 100, 100, waypoints, middle!, { x: 0, y: 5 });
    expect(next[0].y).toBe(5);
    expect(next[1].y).toBe(5);
  });

  it("creates two vertical waypoints when dragging vertical-only chord with no waypoints", () => {
    const segments = buildSegments(0, 0, 0, 100, []);
    const seg = segments[0];
    expect(seg!.orientation).toBe("vertical");
    const next = computeSegmentDrag(0, 0, 0, 100, [], seg!, { x: 12, y: 0 });
    expect(next).toEqual([
      { x: 12, y: 0 },
      { x: 12, y: 100 },
    ]);
  });
});

describe("getPointAtOffset", () => {
  it("returns source at 0 and target at 1 for a straight segment", () => {
    expect(getPointAtOffset(0, 0, 100, 0, [], 0)).toEqual({ x: 0, y: 0 });
    expect(getPointAtOffset(0, 0, 100, 0, [], 1)).toEqual({ x: 100, y: 0 });
    expect(getPointAtOffset(0, 0, 100, 0, [], 0.5)).toEqual({ x: 50, y: 0 });
  });

  it("walks two orthogonal legs by Euclidean length share", () => {
    const point = getPointAtOffset(0, 0, 100, 100, [{ x: 100, y: 0 }], 0.5);
    expect(point).toEqual({ x: 100, y: 0 });
  });
});

describe("getClosestOffsetOnPath", () => {
  it("maps a point near the midpoint to ~0.5", () => {
    const offset = getClosestOffsetOnPath(0, 0, 100, 0, [], { x: 52, y: 4 });
    expect(offset).toBeGreaterThan(0.45);
    expect(offset).toBeLessThan(0.55);
  });
});
