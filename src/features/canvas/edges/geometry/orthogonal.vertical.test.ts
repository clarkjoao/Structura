import { describe, expect, it } from "vitest";
import { pathThroughPoints, stepPathPoints, verticalStepPathPoints } from "./orthogonal";

/**
 * Step paths in a top-to-bottom diagram (ADR-0013): the left-to-right rule in
 * the mirror, so an edge leaves a bottom handle downwards and arrives on a top
 * handle from above — the arrowhead takes its angle from that last leg.
 */
describe("verticalStepPathPoints", () => {
  it("leaves downwards and arrives from above through the corners", () => {
    const source = { x: 100, y: 0 };
    const target = { x: 300, y: 400 };
    const corners = [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ];
    expect(verticalStepPathPoints(source, target, corners)).toEqual([
      source,
      { x: 100, y: 200 },
      { x: 300, y: 200 },
      target,
    ]);
  });

  it("reaches a corner that sits off the handle by stepping down first, not along the border", () => {
    // The layout box and the drawn box disagree by 11px on the source's x.
    const source = { x: 943.5, y: 508.5 };
    const target = { x: 932.5, y: 899 };
    const points = verticalStepPathPoints(source, target, [{ x: 932.5, y: 687.75 }]);
    expect(points[1]).toEqual({ x: 943.5, y: 687.75 });
    // The left-to-right rule would have jogged sideways along the node's bottom.
    expect(stepPathPoints(source, target, [{ x: 932.5, y: 687.75 }])[1]).toEqual({
      x: 932.5,
      y: 508.5,
    });
  });

  it("arrives on the target vertically even when the last corner is off its axis", () => {
    const points = verticalStepPathPoints({ x: 0, y: 0 }, { x: 50, y: 300 }, [{ x: 0, y: 150 }]);
    const last = points[points.length - 1]!;
    const beforeLast = points[points.length - 2]!;
    expect(beforeLast.x).toBe(last.x);
    expect(beforeLast.y).toBeLessThan(last.y);
  });
});

describe("pathThroughPoints", () => {
  it("writes orthogonal legs as H and V commands", () => {
    expect(
      pathThroughPoints([
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 30 },
      ]),
    ).toBe("M 0 0 V 10 H 20 V 30");
  });

  it("is empty for no points", () => {
    expect(pathThroughPoints([])).toBe("");
  });
});
