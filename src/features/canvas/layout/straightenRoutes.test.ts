import { describe, expect, it } from "vitest";
import { straightenPolyline, straightenPolylines } from "./straightenRoutes";

const p = (x: number, y: number) => ({ x, y });

describe("straightenPolyline", () => {
  it("removes a small jog right after the source, moving the run onto the handle's line", () => {
    // Out of the handle at y=100, a 10px step down, then on to a corner at x=300.
    const route = [p(0, 100), p(40, 100), p(40, 110), p(300, 110), p(300, 400), p(500, 400)];
    expect(straightenPolyline(route)).toEqual([p(0, 100), p(300, 100), p(300, 400), p(500, 400)]);
  });

  it("removes the same jog right before the target", () => {
    const route = [p(0, 0), p(200, 0), p(200, 290), p(460, 290), p(460, 300), p(500, 300)];
    expect(straightenPolyline(route)).toEqual([p(0, 0), p(200, 0), p(200, 300), p(500, 300)]);
  });

  it("leaves a jog taller than the noise threshold: that is routing, not noise", () => {
    const route = [p(0, 100), p(40, 100), p(40, 160), p(300, 160), p(300, 400), p(500, 400)];
    expect(straightenPolyline(route)).toBe(route);
  });

  it("leaves a jog into a U-turn", () => {
    const route = [p(0, 100), p(40, 100), p(40, 110), p(-200, 110), p(-200, 400), p(500, 400)];
    expect(straightenPolyline(route)).toBe(route);
  });

  it("never moves an endpoint: a run that ends on the target stays put", () => {
    const route = [p(0, 100), p(40, 100), p(40, 110), p(300, 110), p(500, 110)];
    expect(straightenPolyline(route)).toBe(route);
  });

  it("straightens a tall jog at a container's border, where ELK puts ports of its own", () => {
    // ELK attached at y=160, the container's handle is at y=100.
    const route = [p(0, 100), p(40, 100), p(40, 160), p(300, 160), p(300, 400), p(500, 400)];
    expect(straightenPolyline(route, { source: true })).toEqual([
      p(0, 100),
      p(300, 100),
      p(300, 400),
      p(500, 400),
    ]);
    expect(straightenPolyline(route, { target: true })).toBe(route);
  });

  it("keeps every leg horizontal or vertical", () => {
    const route = [p(0, 100), p(40, 100), p(40, 110), p(300, 110), p(300, 400), p(500, 400)];
    const out = straightenPolyline(route);
    for (let i = 0; i < out.length - 1; i += 1) {
      const a = out[i]!;
      const b = out[i + 1]!;
      expect(a.x === b.x || a.y === b.y, `leg ${i}`).toBe(true);
    }
  });
});

describe("straightenPolylines", () => {
  it("does not straighten a route when that adds a crossing", () => {
    const jogged = [p(0, 100), p(40, 100), p(40, 110), p(300, 110), p(300, 400), p(500, 400)];
    // A vertical at x=100 spanning y 90..105: crossed by y=100, missed by y=110.
    const other = [p(100, 90), p(100, 105)];
    const out = straightenPolylines(
      new Map([
        ["jogged", jogged],
        ["other", other],
      ]),
    );
    expect(out.get("jogged")).toBe(jogged);
  });

  it("straightens when nothing is in the way", () => {
    const jogged = [p(0, 100), p(40, 100), p(40, 110), p(300, 110), p(300, 400), p(500, 400)];
    const out = straightenPolylines(new Map([["jogged", jogged]]));
    expect(out.get("jogged")).not.toBe(jogged);
  });
});

describe("straightenPolylines — obstacles", () => {
  it("does not move a run through a node it did not cross", () => {
    const jogged = [p(0, 100), p(40, 100), p(40, 160), p(300, 160), p(300, 400), p(500, 400)];
    // A node between y=80 and y=130: the run at y=160 clears it, y=100 would not.
    const node = { x: 120, y: 80, width: 60, height: 50 };
    const options = {
      containerEnds: new Map([["jogged", { source: true }]]),
      obstacles: new Map([["jogged", [node]]]),
    };
    expect(straightenPolylines(new Map([["jogged", jogged]]), options).get("jogged")).toBe(jogged);
    expect(
      straightenPolylines(new Map([["jogged", jogged]]), { ...options, obstacles: new Map() }).get(
        "jogged",
      ),
    ).not.toBe(jogged);
  });
});
