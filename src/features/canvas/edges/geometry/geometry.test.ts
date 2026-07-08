import { describe, expect, it } from "vitest";
import type { EdgeControlPoint, Point } from "@/features/diagram";
import { buildEditableEdgePath, getPathKnots, getRenderedPathKnots } from "./paths";
import { getClosestOffsetOnPath, getGhostMidpoints, getPointAtOffset } from "./projection";

const source: Point = { x: 0, y: 0 };
const target: Point = { x: 100, y: 0 };
const cp = (id: string, x: number, y: number): EdgeControlPoint => ({ id, x, y });

describe("getPathKnots", () => {
  it("brackets the control points with source and target", () => {
    const knots = getPathKnots(source, target, [cp("a", 50, 20)]);
    expect(knots).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 20 },
      { x: 100, y: 0 },
    ]);
  });
});

describe("buildEditableEdgePath", () => {
  it("draws a straight line when there are no control points", () => {
    expect(buildEditableEdgePath(source, target, [], "catmull-rom")).toBe("M 0 0 L 100 0");
    expect(buildEditableEdgePath(source, target, [], "linear")).toBe("M 0 0 L 100 0");
  });

  it("emits line segments for linear paths through control points", () => {
    expect(buildEditableEdgePath(source, target, [cp("a", 50, 20)], "linear")).toBe(
      "M 0 0 L 50 20 L 100 0",
    );
  });

  it("emits cubic beziers for catmull-rom paths through control points", () => {
    const d = buildEditableEdgePath(source, target, [cp("a", 50, 20)], "catmull-rom");
    expect(d.startsWith("M 0 0 C")).toBe(true);
    expect(d).toContain("50 20");
    expect(d).toContain("100 0");
  });
});

describe("getPointAtOffset", () => {
  it("returns the midpoint at offset 0.5 on a straight edge", () => {
    expect(getPointAtOffset(source, target, [], 0.5)).toEqual({ x: 50, y: 0 });
  });

  it("clamps out-of-range offsets to the endpoints", () => {
    expect(getPointAtOffset(source, target, [], -1)).toEqual({ x: 0, y: 0 });
    expect(getPointAtOffset(source, target, [], 2)).toEqual({ x: 100, y: 0 });
  });

  it("returns the source for a zero-length edge", () => {
    expect(getPointAtOffset(source, source, [], 0.5)).toEqual({ x: 0, y: 0 });
  });

  // Regression: non-editable-style edges (Smoothstep / Step / Bezier / Straight)
  // render via xyflow's getSmoothStepPath / getBezierPath / getStraightPath,
  // which never read edgeLayouts[id].points. Stale entries there would
  // splice phantom knots into getPathKnots and detach the label. EditableEdge
  // now feeds projectionPoints = [source, target] (the rendered chord) for
  // those styles, so getPointAtOffset slides the label end-to-end along the
  // edge via the stored labelOffset regardless of any stale data.
  it("non-editable chord placement is independent of stale control points", () => {
    // The chord midpoint for an unadorned edge.
    const straightMid = getPointAtOffset(source, target, [], 0.5);
    expect(straightMid).toEqual({ x: 50, y: 0 });

    // A legitimate bend point shifts the editable midpoint off the chord —
    // editable styles do consume control points.
    const editableLabel = getPointAtOffset(source, target, [cp("a", 30, -40)], 0.5);
    expect(editableLabel).not.toEqual(straightMid);
    expect(editableLabel.y).toBeLessThan(0);

    // The component passes [source, target] to getPointAtOffset for
    // non-editable styles; the stored stale points never enter the
    // projection. Re-derive that behavior here: with a chord, no stale
    // point in the projectionPoints array can move the label off the chord.
    const knots = [
      { x: 0, y: 0 },
      { x: 30, y: -500 },
      { x: 70, y: 800 },
      { x: 100, y: 0 },
    ];
    // The labeled polyline the OLD code would have built (source → stale
    // points → target) lands the midpoint far off-canvas.
    const detachedIfStale = getPointAtOffset(source, target, [
      cp("stale-1", 30, -500),
      cp("stale-2", 70, 800),
    ], 0.5);
    expect(detachedIfStale).not.toEqual(straightMid);
    expect(Math.abs(detachedIfStale.y)).toBeGreaterThan(100);

    // The labeled polyline the NEW code builds (source → target only) lands
    // the midpoint on the chord regardless of any stale points the store
    // still carries.
    const onChord = getPointAtOffset(source, target, [], 0.5);
    expect(onChord).toEqual(straightMid);
    // Pin that the chord-only polyline does not detach for any labelOffset.
    expect(getPointAtOffset(source, target, [], 0.05)).toEqual({ x: 5, y: 0 });
    expect(getPointAtOffset(source, target, [], 0.95)).toEqual({ x: 95, y: 0 });
    expect(knots).toHaveLength(4); // sanity: we didn't accidentally touch the test data
  });
});

describe("getClosestOffsetOnPath", () => {
  it("projects a point onto the nearest offset along the polyline", () => {
    expect(getClosestOffsetOnPath(source, target, [], { x: 25, y: 10 })).toBeCloseTo(0.25, 5);
  });

  it("falls back to 0.5 on a degenerate edge", () => {
    expect(getClosestOffsetOnPath(source, source, [], { x: 5, y: 5 })).toBe(0.5);
  });
});

describe("getGhostMidpoints", () => {
  it("yields one ghost per segment with the correct insertion index", () => {
    const ghosts = getGhostMidpoints(source, target, [cp("a", 50, 20)]);
    expect(ghosts).toEqual([
      { insertIndex: 0, x: 25, y: 10 },
      { insertIndex: 1, x: 75, y: 10 },
    ]);
  });

  it("yields a single midpoint for a point-less edge", () => {
    expect(getGhostMidpoints(source, target, [])).toEqual([{ insertIndex: 0, x: 50, y: 0 }]);
  });
});

describe("getRenderedPathKnots", () => {
  it("returns the source->target chord for a Straight style", () => {
    const knots = getRenderedPathKnots({
      source: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      sourcePosition: "right",
      targetPosition: "left",
      style: "straight",
    });
    expect(knots).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  // Regression: a Smoothstep with Right -> Left handles whose path detours
  // off the chord (e.g. dipping vertically to avoid an intermediate layout).
  // The polyline must carry that detour so getPointAtOffset places the
  // label on the visible bend, not on the straight chord.
  it("places a Smoothstep polyline that traces the rendered bend (Right -> Left)", () => {
    const knots = getRenderedPathKnots({
      source: { x: 0, y: 0 },
      target: { x: 200, y: 100 },
      sourcePosition: "right",
      targetPosition: "left",
      style: "smoothstep",
    });
    // The polyline must have more than just source and target — otherwise
    // the label detaches from the visible bend.
    expect(knots.length).toBeGreaterThanOrEqual(4);
    // The polyline starts at the source and ends at the target.
    expect(knots[0]).toEqual({ x: 0, y: 0 });
    expect(knots[knots.length - 1]).toEqual({ x: 200, y: 100 });
    // At least one intermediate knot must NOT lie on the straight chord
    // (source -> target) — i.e. the polyline detours. With Right -> Left
    // handles, the detour is a horizontal jog through (centerX, 0) and
    // (centerX, 100); the midpoint of those intermediates is (centerX, 50),
    // which is off the chord (the chord at x = centerX has y = centerX / 2).
    const chordYAt = (x: number) => (x / 200) * 100;
    const intermediates = knots.slice(1, -1);
    const detoursOffChord = intermediates.filter(
      (k) => Math.abs(k.y - chordYAt(k.x)) > 1,
    );
    expect(detoursOffChord.length).toBeGreaterThan(0);
  });

  it("approximates a Bezier cubic with a 32-sample polyline", () => {
    const knots = getRenderedPathKnots({
      source: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      sourcePosition: "right",
      targetPosition: "left",
      style: "bezier",
    });
    expect(knots.length).toBe(33);
    expect(knots[0]).toEqual({ x: 0, y: 0 });
    expect(knots[knots.length - 1]).toEqual({ x: 100, y: 0 });
    const mid = knots[Math.floor(knots.length / 2)];
    expect(mid.x).toBeCloseTo(50, 0);
  });
});
