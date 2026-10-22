import { describe, expect, it } from "vitest";
import { buildPathWithHops, findLineHops, LINE_HOP_RADIUS } from "./lineHops";

const p = (x: number, y: number) => ({ x, y });

describe("findLineHops", () => {
  it("makes the horizontal edge hop over the vertical one", () => {
    const hops = findLineHops([
      { id: "h", points: [p(0, 50), p(100, 50)] },
      { id: "v", points: [p(50, 0), p(50, 100)] },
    ]);
    expect(hops.get("h")).toEqual([{ segIndex: 0, x: 50, y: 50 }]);
    expect(hops.has("v")).toBe(false);
  });

  it("does not hop where two edges only touch at an end", () => {
    const hops = findLineHops([
      { id: "h", points: [p(0, 50), p(100, 50)] },
      { id: "v", points: [p(50, 50), p(50, 100)] },
    ]);
    expect(hops.size).toBe(0);
  });

  it("does not hop over itself", () => {
    // A route that loops back across its own vertical leg.
    const hops = findLineHops([
      { id: "loop", points: [p(0, 50), p(100, 50), p(100, 0), p(50, 0), p(50, 100)] },
    ]);
    expect(hops.size).toBe(0);
  });

  it("lists several hops on one segment in the direction of travel", () => {
    const hops = findLineHops([
      { id: "h", points: [p(200, 50), p(0, 50)] },
      { id: "v1", points: [p(50, 0), p(50, 100)] },
      { id: "v2", points: [p(150, 0), p(150, 100)] },
    ]);
    expect(hops.get("h")?.map((hop) => hop.x)).toEqual([150, 50]);
  });

  it("finds the crossing on the right segment of a multi-leg route", () => {
    const hops = findLineHops([
      { id: "h", points: [p(0, 0), p(0, 50), p(100, 50)] },
      { id: "v", points: [p(50, 0), p(50, 100)] },
    ]);
    expect(hops.get("h")).toEqual([{ segIndex: 1, x: 50, y: 50 }]);
  });
});

describe("buildPathWithHops", () => {
  it("draws a plain polyline when there is nothing to hop", () => {
    expect(buildPathWithHops([p(0, 0), p(100, 0), p(100, 50)], [])).toBe("M 0 0 L 100 0 L 100 50");
  });

  it("bridges the crossing with an arc of the hop radius", () => {
    const r = LINE_HOP_RADIUS;
    expect(buildPathWithHops([p(0, 50), p(100, 50)], [{ segIndex: 0, x: 50, y: 50 }])).toBe(
      `M 0 50 L ${50 - r} 50 A ${r} ${r} 0 0 1 ${50 + r} 50 L 100 50`,
    );
  });

  it("bulges the same way whichever direction the segment runs", () => {
    const right = buildPathWithHops([p(0, 50), p(100, 50)], [{ segIndex: 0, x: 50, y: 50 }]);
    const left = buildPathWithHops([p(100, 50), p(0, 50)], [{ segIndex: 0, x: 50, y: 50 }]);
    // Clockwise going right, counter-clockwise going left: both arcs go up.
    expect(right).toContain("0 0 1");
    expect(left).toContain("0 0 0");
  });

  it("drops a hop that sits too close to a corner to fit", () => {
    expect(buildPathWithHops([p(0, 50), p(100, 50)], [{ segIndex: 0, x: 3, y: 50 }])).toBe(
      "M 0 50 L 100 50",
    );
  });

  it("shares the room between two hops close together", () => {
    const d = buildPathWithHops(
      [p(0, 50), p(100, 50)],
      [
        { segIndex: 0, x: 50, y: 50 },
        { segIndex: 0, x: 58, y: 50 },
      ],
    );
    // 8px apart: each gets a 4px radius instead of overlapping at 6.
    expect(d).toContain("A 4 4");
    expect(d).not.toContain(`A ${LINE_HOP_RADIUS}`);
  });

  it("skips a stale hop that is no longer on its segment", () => {
    expect(buildPathWithHops([p(0, 50), p(100, 50)], [{ segIndex: 0, x: 50, y: 80 }])).toBe(
      "M 0 50 L 100 50",
    );
  });
});
