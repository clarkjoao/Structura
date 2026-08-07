import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import type { Point } from "@/features/diagram";
import { buildStepPath, defaultOrthogonalCorners } from "../edges/geometry/orthogonal";
import { buildRenderedPolylines, handleAnchor, stepPolyline } from "./renderedEdgePath";

/** Re-derives the path string from a polyline, to compare against buildStepPath. */
function pathFromPolyline(points: Point[]): string {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    path += ` H ${points[i].x} V ${points[i].y}`;
  }
  return path;
}

/** Samples the SVG path's H/V commands into the points it visits. */
function pointsFromPath(path: string): Point[] {
  const tokens = path.trim().split(/\s+/);
  const points: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i];
    if (command === "M") {
      current = { x: Number(tokens[i + 1]), y: Number(tokens[i + 2]) };
      points.push(current);
      i += 3;
    } else if (command === "H") {
      const x = Number(tokens[i + 1]);
      if (x !== current.x) {
        current = { x, y: current.y };
        points.push(current);
      }
      i += 2;
    } else if (command === "V") {
      const y = Number(tokens[i + 1]);
      if (y !== current.y) {
        current = { x: current.x, y };
        points.push(current);
      }
      i += 2;
    } else {
      i += 1;
    }
  }
  return points;
}

describe("stepPolyline", () => {
  /**
   * The whole point of this metric is that it traces the same route the canvas
   * draws. If `buildStepPath` ever changes shape, this fails.
   */
  it("visits exactly the points buildStepPath draws", () => {
    const source: Point = { x: 100, y: 50 };
    const target: Point = { x: 500, y: 300 };
    const corners = defaultOrthogonalCorners(source, target, Position.Right);

    const polyline = stepPolyline(source, target, corners);
    const fromPath = pointsFromPath(buildStepPath(source, target, corners));

    expect(polyline).toEqual(fromPath);
  });

  it("produces the classic Z route for a default horizontal exit", () => {
    const source: Point = { x: 0, y: 0 };
    const target: Point = { x: 400, y: 200 };
    const corners = defaultOrthogonalCorners(source, target, Position.Right);

    expect(stepPolyline(source, target, corners)).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 400, y: 200 },
    ]);
  });

  it("stays a straight line when source and target share a row", () => {
    const points = stepPolyline({ x: 0, y: 50 }, { x: 300, y: 50 }, []);
    expect(points).toEqual([
      { x: 0, y: 50 },
      { x: 300, y: 50 },
    ]);
  });

  it("round-trips through the path string", () => {
    const source: Point = { x: 10, y: 20 };
    const target: Point = { x: 210, y: 120 };
    const corners = [
      { x: 90, y: 20 },
      { x: 90, y: 120 },
    ];
    const polyline = stepPolyline(source, target, corners);
    expect(pathFromPolyline(polyline)).toBe(
      pathFromPolyline(pointsFromPath(buildStepPath(source, target, corners))),
    );
  });
});

describe("handleAnchor", () => {
  const box = { x: 100, y: 200, width: 180, height: 80 };

  it("puts a lone handle at the vertical centre, on the right for a source", () => {
    expect(handleAnchor(box, "source", 0, 1)).toEqual({ x: 280, y: 240 });
  });

  it("puts a lone target handle on the left", () => {
    expect(handleAnchor(box, "target", 0, 1)).toEqual({ x: 100, y: 240 });
  });

  it("spaces multiple handles by (i + 1) / (n + 1), as buildHandles does", () => {
    expect(handleAnchor(box, "source", 0, 3).y).toBeCloseTo(200 + 80 * 0.25);
    expect(handleAnchor(box, "source", 1, 3).y).toBeCloseTo(200 + 80 * 0.5);
    expect(handleAnchor(box, "source", 2, 3).y).toBeCloseTo(200 + 80 * 0.75);
  });

  it("clamps beyond the four available handles", () => {
    expect(handleAnchor(box, "source", 9, 9).y).toBe(handleAnchor(box, "source", 3, 4).y);
  });
});

describe("buildRenderedPolylines", () => {
  const boxes = new Map([
    ["a", { x: 0, y: 0, width: 180, height: 80 }],
    ["b", { x: 500, y: 0, width: 180, height: 80 }],
    ["c", { x: 500, y: 300, width: 180, height: 80 }],
  ]);

  it("starts at the source's right edge and ends at the target's left edge", () => {
    const [edge] = buildRenderedPolylines(boxes, [{ id: "e1", sourceId: "a", targetId: "b" }]);
    expect(edge.points[0]).toEqual({ x: 180, y: 40 });
    expect(edge.points[edge.points.length - 1]).toEqual({ x: 500, y: 40 });
  });

  it("spreads two edges from the same node across different handles", () => {
    const built = buildRenderedPolylines(boxes, [
      { id: "e1", sourceId: "a", targetId: "b" },
      { id: "e2", sourceId: "a", targetId: "c" },
    ]);
    expect(built[0].points[0].y).not.toBe(built[1].points[0].y);
  });

  it("uses supplied corners instead of the default route", () => {
    const [edge] = buildRenderedPolylines(boxes, [
      { id: "e1", sourceId: "a", targetId: "b", corners: [{ x: 300, y: 200 }] },
    ]);
    expect(edge.points).toContainEqual({ x: 300, y: 200 });
  });

  it("skips an edge whose endpoint has no box", () => {
    expect(buildRenderedPolylines(boxes, [{ id: "x", sourceId: "a", targetId: "ghost" }])).toEqual(
      [],
    );
  });
});
