import { describe, expect, it } from "vitest";
import { alignmentExtent, buildAlignmentTargets, findAlignment } from "./alignment";

describe("buildAlignmentTargets", () => {
  it("emits left/center/right and top/middle/bottom lines per node", () => {
    const targets = buildAlignmentTargets([{ x: 0, y: 0, width: 100, height: 40 }]);
    expect(targets.xs.map((l) => l.pos)).toEqual([0, 50, 100]);
    expect(targets.ys.map((l) => l.pos)).toEqual([0, 20, 40]);
    // x lines carry the node's vertical extent for drawing the guide.
    expect(targets.xs[0]).toEqual({ pos: 0, min: 0, max: 40 });
    expect(targets.ys[2]).toEqual({ pos: 40, min: 0, max: 100 });
  });

  it("skips zero-size boxes", () => {
    expect(buildAlignmentTargets([{ x: 0, y: 0, width: 0, height: 40 }])).toEqual({
      xs: [],
      ys: [],
    });
  });
});

describe("findAlignment", () => {
  const lines = [
    { pos: 0, min: 0, max: 40 },
    { pos: 50, min: 0, max: 40 },
    { pos: 100, min: 0, max: 40 },
  ];

  it("returns the nearest line within threshold", () => {
    expect(findAlignment(47, lines, 6)?.pos).toBe(50);
  });

  it("returns null when nothing is within threshold", () => {
    expect(findAlignment(30, lines, 6)).toBeNull();
  });
});

describe("alignmentExtent", () => {
  it("stretches the guide to reach the dragged handle", () => {
    expect(alignmentExtent({ pos: 50, min: 0, max: 40 }, 90)).toEqual({ from: 0, to: 90 });
    expect(alignmentExtent({ pos: 50, min: 20, max: 40 }, -10)).toEqual({ from: -10, to: 40 });
  });
});
