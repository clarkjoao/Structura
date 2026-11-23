import { describe, expect, it } from "vitest";
import type { KindOverlay } from "./kind.types";
import {
  OVERLAY_LABEL_DEPTH,
  overlayBounds,
  overlayCurvePoints,
  unionRect,
} from "./overlay.geometry";

const band = (axis: "x" | "y", curve: KindOverlay["curve"] = []): KindOverlay => ({
  axis,
  at: -100,
  depth: curve.length ? 96 : 36,
  segments: [
    { id: "a", label: "A", from: 50, to: 300 },
    { id: "b", label: "B", from: 300, to: 600 },
  ],
  separators: [{ along: 300, from: 0, to: 400 }],
  curve,
});

describe("overlay geometry", () => {
  it("bounds a left-to-right band and its separators", () => {
    expect(overlayBounds(band("x"))).toEqual({ x: 50, y: -100, width: 550, height: 500 });
  });

  it("bounds a top-to-bottom band across x", () => {
    expect(overlayBounds(band("y"))).toEqual({ x: -100, y: 50, width: 500, height: 550 });
  });

  it("includes the curve's points and depth", () => {
    const overlay = band("x", [{ id: "p", along: 700, value: 1, tone: "success" }]);
    const bounds = overlayBounds(overlay)!;
    expect(bounds.x + bounds.width).toBe(700);
    expect(bounds.y).toBe(-100);
  });

  it("is null when the overlay draws nothing", () => {
    expect(
      overlayBounds({ axis: "x", at: 0, depth: 0, segments: [], separators: [], curve: [] }),
    ).toBeNull();
  });

  it("maps curve values high near the labels, low near the lanes", () => {
    const overlay = band("x", [
      { id: "hi", along: 100, value: 1, tone: "success" },
      { id: "lo", along: 200, value: 0, tone: "danger" },
    ]);
    const [hi, lo] = overlayCurvePoints(overlay);
    expect(hi).toMatchObject({ id: "hi", x: 100, y: -100 + OVERLAY_LABEL_DEPTH + 6 });
    expect(lo!.x).toBe(200);
    expect(lo!.y).toBeGreaterThan(hi!.y);
    expect(lo!.y).toBeLessThan(-100 + 96);
    const [vertical] = overlayCurvePoints({ ...overlay, axis: "y" });
    expect(vertical).toMatchObject({ x: hi!.y, y: 100 });
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
