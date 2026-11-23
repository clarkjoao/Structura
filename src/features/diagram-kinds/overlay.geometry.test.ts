import { describe, expect, it } from "vitest";
import type { KindOverlay } from "./kind.types";
import { overlayBounds, unionRect } from "./overlay.geometry";

const band = (axis: "x" | "y"): KindOverlay => ({
  axis,
  at: -100,
  depth: 36,
  segments: [
    { id: "a", label: "A", from: 50, to: 300 },
    { id: "b", label: "B", from: 300, to: 600 },
  ],
  separators: [{ along: 300, from: 0, to: 400 }],
});

describe("overlay geometry", () => {
  it("bounds a left-to-right band and its separators", () => {
    expect(overlayBounds(band("x"))).toEqual({ x: 50, y: -100, width: 550, height: 500 });
  });

  it("bounds a top-to-bottom band across x", () => {
    expect(overlayBounds(band("y"))).toEqual({ x: -100, y: 50, width: 500, height: 550 });
  });

  it("includes lines between lanes", () => {
    const bounds = overlayBounds({
      ...band("x"),
      lines: [{ id: "v", across: 700, from: 0, to: 900 }],
    })!;
    expect(bounds.x).toBe(0);
    expect(bounds.x + bounds.width).toBe(900);
    expect(bounds.y + bounds.height).toBe(700);
  });

  it("is null when the overlay draws nothing", () => {
    expect(overlayBounds({ axis: "x", at: 0, depth: 0, segments: [], separators: [] })).toBeNull();
  });

  it("joins rectangles", () => {
    const r = { x: 0, y: 0, width: 10, height: 10 };
    expect(unionRect(r, null)).toBe(r);
    expect(unionRect(r, { x: -5, y: 5, width: 5, height: 20 })).toEqual({
      x: -5,
      y: 0,
      width: 15,
      height: 25,
    });
  });
});
