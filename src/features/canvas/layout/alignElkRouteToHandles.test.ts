import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { defaultOrthogonalCorners } from "../edges/geometry/orthogonal";
import { alignElkRouteToHandles } from "./alignElkRouteToHandles";
import { stepPolyline } from "./renderedEdgePath";

describe("alignElkRouteToHandles", () => {
  it("falls back to the default mid-X Z when the route is missing", () => {
    const source = { x: 0, y: 40 };
    const target = { x: 200, y: 80 };
    expect(alignElkRouteToHandles(undefined, source, target)).toEqual(
      defaultOrthogonalCorners(source, target, Position.Right),
    );
    expect(alignElkRouteToHandles([], source, target)).toEqual(
      defaultOrthogonalCorners(source, target, Position.Right),
    );
  });

  it("turns a two-point border route into an L from the real handles", () => {
    const source = { x: 0, y: 40 };
    const target = { x: 200, y: 80 };
    const corners = alignElkRouteToHandles(
      [
        { x: 0, y: 40 },
        { x: 200, y: 80 },
      ],
      source,
      target,
    );
    const poly = stepPolyline(source, target, corners);
    expect(poly[0]).toEqual(source);
    expect(poly[poly.length - 1]).toEqual(target);
    expect(poly[1]!.y).toBe(source.y);
  });

  it("keeps the last leg horizontal so marker-end triangles point into the handle", () => {
    // Without an entry stub, H-then-V into the target ends on a vertical leg and
    // SVG orients the arrow upward (the Merchant / PVC screenshot failure).
    const route = [
      { x: 100, y: 10 },
      { x: 160, y: 10 },
      { x: 160, y: 90 },
      { x: 300, y: 90 },
    ];
    const source = { x: 100, y: 40 };
    const target = { x: 300, y: 50 };
    const corners = alignElkRouteToHandles(route, source, target);
    const poly = stepPolyline(source, target, corners);
    const a = poly[poly.length - 2]!;
    const b = poly[poly.length - 1]!;
    expect(b).toEqual(target);
    expect(a.y).toBeCloseTo(target.y);
    expect(a.x).toBeLessThan(target.x);
  });

  it("keeps the first leg horizontal so the source marker (if any) leaves to the right", () => {
    const route = [
      { x: 0, y: 80 },
      { x: 80, y: 80 },
      { x: 80, y: 20 },
      { x: 220, y: 20 },
    ];
    const source = { x: 0, y: 40 };
    const target = { x: 220, y: 30 };
    const corners = alignElkRouteToHandles(route, source, target);
    const poly = stepPolyline(source, target, corners);
    expect(poly[1]!.y).toBeCloseTo(source.y);
    expect(poly[1]!.x).toBeGreaterThan(source.x);
  });

  it("keeps an ELK vertical corridor so the path does not collapse to mid-X", () => {
    const route = [
      { x: 0, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 120 },
      { x: 200, y: 120 },
    ];
    const source = { x: 0, y: 30 };
    const target = { x: 200, y: 110 };

    const corners = alignElkRouteToHandles(route, source, target);
    const poly = stepPolyline(source, target, corners);
    const usesCorridor = poly.some((point) => Math.abs(point.x - 40) < 1);
    expect(usesCorridor).toBe(true);
  });

  it("only emits axis-aligned legs when replayed through buildStepPath", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 80, y: 40 },
      { x: 80, y: 100 },
      { x: 220, y: 60 },
    ];
    const source = { x: 0, y: 25 };
    const target = { x: 220, y: 75 };
    const corners = alignElkRouteToHandles(route, source, target);
    const poly = stepPolyline(source, target, corners);

    for (let i = 1; i < poly.length; i += 1) {
      const a = poly[i - 1]!;
      const b = poly[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
  });
});
