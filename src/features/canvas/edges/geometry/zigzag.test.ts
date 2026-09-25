import { describe, expect, it } from "vitest";
import { buildZigzagPath, getZigzagKnots } from "./paths";

describe("zigzag edge", () => {
  it("runs from source to target with a zigzag a third of the way along", () => {
    const knots = getZigzagKnots({ x: 0, y: 0 }, { x: 200, y: 0 });
    expect(knots[0]).toEqual({ x: 0, y: 0 });
    expect(knots[knots.length - 1]).toEqual({ x: 200, y: 0 });
    expect(knots).toHaveLength(6);
    // The two inner knots swing to opposite sides of the line, around the
    // third — clear of the label, which sits in the middle.
    expect(Math.sign(knots[2].y)).toBe(-Math.sign(knots[3].y));
    expect(knots[2].x).toBeLessThan(200 / 3);
    expect(knots[3].x).toBeGreaterThan(200 / 3);
    expect(knots[4].x).toBeLessThan(100);
  });

  it("keeps its size on a long edge", () => {
    const short = getZigzagKnots({ x: 0, y: 0 }, { x: 200, y: 0 });
    const long = getZigzagKnots({ x: 0, y: 0 }, { x: 2000, y: 0 });
    expect(Math.abs(long[2].y)).toBeCloseTo(Math.abs(short[2].y));
  });

  it("is straight when there is no room for the zigzag", () => {
    expect(getZigzagKnots({ x: 0, y: 0 }, { x: 20, y: 0 })).toHaveLength(2);
    expect(buildZigzagPath({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe("M 0 0 L 20 0");
  });
});
