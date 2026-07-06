import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import type { Point } from "@/features/diagram";
import {
  buildStepPath,
  buildStepSegments,
  computeSegmentDrag,
  defaultOrthogonalCorners,
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
