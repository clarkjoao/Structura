import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import type { Point } from "@/features/diagram";
import {
  buildStepPath,
  buildStepSegments,
  clampSegmentLength,
  computeCornerDrag,
  computeSegmentDrag,
  defaultOrthogonalCorners,
  pruneRedundantCorners,
  snapToGrid,
} from "./orthogonal";

const source: Point = { x: 0, y: 0 };
const target: Point = { x: 100, y: 80 };

describe("defaultOrthogonalCorners", () => {
  it("bends vertically at the midpoint for horizontal exits", () => {
    expect(defaultOrthogonalCorners(source, target, Position.Right)).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 80 },
    ]);
  });

  it("bends horizontally at the midpoint for vertical exits", () => {
    expect(defaultOrthogonalCorners(source, target, Position.Bottom)).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ]);
  });
});

describe("buildStepPath", () => {
  it("emits only horizontal/vertical commands (sharp corners)", () => {
    const corners = defaultOrthogonalCorners(source, target, Position.Right);
    const d = buildStepPath(source, target, corners);
    expect(d).toBe("M 0 0 H 50 V 0 H 50 V 80 H 100 V 80");
    expect(d).not.toContain("C");
    expect(d).not.toContain("Q");
  });
});

describe("buildStepSegments", () => {
  it("produces one straight segment per knot pair with orientation", () => {
    const corners: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 80 },
    ];
    const segments = buildStepSegments(source, target, corners);
    expect(segments.map((s) => s.orientation)).toEqual(["horizontal", "vertical", "horizontal"]);
    expect(segments[1]).toMatchObject({ index: 1, x1: 50, y1: 0, x2: 50, y2: 80 });
  });
});

describe("computeSegmentDrag", () => {
  it("moves a middle vertical segment on X, keeping the route orthogonal", () => {
    const corners: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 80 },
    ];
    const segments = buildStepSegments(source, target, corners);
    const vertical = segments[1];
    const next = computeSegmentDrag(source, target, corners, vertical, { x: 20, y: 5 });
    expect(next).toEqual([
      { x: 70, y: 0 },
      { x: 70, y: 80 },
    ]);
  });

  it("moves a horizontal segment on Y", () => {
    const corners: Point[] = [
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ];
    const segments = buildStepSegments(source, target, corners);
    const middle = segments[1];
    const next = computeSegmentDrag(source, target, corners, middle, { x: 3, y: 25 });
    expect(next).toEqual([
      { x: 0, y: 65 },
      { x: 100, y: 65 },
    ]);
  });
});

describe("computeCornerDrag", () => {
  // A four-corner staircase whose corner index 1 is fully interior.
  const src: Point = { x: 0, y: 0 };
  const tgt: Point = { x: 200, y: 100 };
  const staircase: Point[] = [
    { x: 50, y: 0 },
    { x: 50, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 100 },
  ];

  it("moves a fully interior corner on both axes, dragging neighbours to stay orthogonal", () => {
    const next = computeCornerDrag(src, tgt, staircase, 1, { x: 20, y: 10 });
    expect(next).toEqual([
      { x: 70, y: 0 },
      { x: 70, y: 60 },
      { x: 150, y: 60 },
      { x: 150, y: 100 },
    ]);
    // Every consecutive knot pair still shares exactly one axis (orthogonal).
    const knots = [src, ...next, tgt];
    for (let i = 1; i < knots.length; i += 1) {
      const sharesAxis = knots[i].x === knots[i - 1].x || knots[i].y === knots[i - 1].y;
      expect(sharesAxis).toBe(true);
    }
  });

  it("constrains a source-adjacent corner to the axis that keeps the endpoint segment straight", () => {
    // Corner 0 joins the (horizontal) source segment: vertical drag is ignored.
    const next = computeCornerDrag(src, tgt, staircase, 0, { x: 30, y: 40 });
    expect(next[0]).toEqual({ x: 80, y: 0 });
    expect(next[1]).toEqual({ x: 80, y: 50 });
  });

  it("clamps a corner so the source segment cannot collapse to zero length", () => {
    const next = computeCornerDrag(src, tgt, staircase, 0, { x: -45, y: 0 });
    // newX would be 5, clamped to MIN_SEGMENT_LENGTH away from source.x (0).
    expect(next[0].x).toBe(10);
  });

  it("returns a copy unchanged for an out-of-range corner index", () => {
    expect(computeCornerDrag(src, tgt, staircase, 9, { x: 5, y: 5 })).toEqual(staircase);
  });
});

describe("clampSegmentLength", () => {
  it("leaves a value that is already far enough from the boundary", () => {
    expect(clampSegmentLength(50, 0, 10)).toBe(50);
  });

  it("pushes a value that is too close to the positive side", () => {
    expect(clampSegmentLength(5, 0, 10)).toBe(10);
  });

  it("pushes a value that is too close on the negative side", () => {
    expect(clampSegmentLength(-3, 0, 10)).toBe(-10);
  });

  it("handles a zero-length case at the boundary", () => {
    expect(clampSegmentLength(0, 0, 10)).toBe(10);
  });
});

describe("pruneRedundantCorners", () => {
  const src: Point = { x: 0, y: 0 };
  const tgt: Point = { x: 100, y: 100 };

  it("keeps corners that actually bend the route", () => {
    const corners: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    expect(pruneRedundantCorners(src, tgt, corners)).toEqual(corners);
  });

  it("drops a corner collinear with its neighbours", () => {
    // The middle corner sits on the straight vertical run 50,0 -> 50,100.
    const corners: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
    ];
    expect(pruneRedundantCorners(src, tgt, corners)).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
  });

  it("drops a corner coincident with a neighbour (zero-length segment)", () => {
    const corners: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    expect(pruneRedundantCorners(src, tgt, corners)).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
  });
});

describe("snapToGrid", () => {
  it("snaps both axes when within threshold", () => {
    expect(snapToGrid({ x: 14, y: 31 }, 15, 7.5)).toEqual({ x: 15, y: 30 });
  });

  it("leaves an axis untouched when the nearest grid line is beyond the threshold", () => {
    expect(snapToGrid({ x: 7, y: 0 }, 15, 3)).toEqual({ x: 7, y: 0 });
  });
});
