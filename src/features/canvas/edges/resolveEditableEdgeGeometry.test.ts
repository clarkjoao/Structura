import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import {
  resolveCurvePoints,
  resolveLabelOffset,
  resolveStepCorners,
} from "./resolveEditableEdgeGeometry";
import { buildStepPath } from "./geometry/orthogonal";

describe("resolveEditableEdgeGeometry", () => {
  const source = { x: 0, y: 50 };
  const target = { x: 200, y: 50 };

  it("prefers stamped step corners over store corners", () => {
    const corners = resolveStepCorners({
      layoutPoints: [
        { id: "a", x: 100, y: 10 },
        { id: "b", x: 100, y: 90 },
      ],
      storeCorners: [{ x: 50, y: 50 }],
      source,
      target,
      sourcePosition: Position.Right,
    });
    expect(corners).toEqual([
      { x: 100, y: 10 },
      { x: 100, y: 90 },
    ]);
  });

  it("falls back to default orthogonal when stamped points are empty", () => {
    const corners = resolveStepCorners({
      layoutPoints: [],
      storeCorners: [{ x: 1, y: 1 }],
      source,
      target,
      sourcePosition: Position.Right,
    });
    expect(corners.length).toBeGreaterThan(0);
    expect(corners).not.toEqual([{ x: 1, y: 1 }]);
  });

  it("uses store corners when layoutPoints is omitted", () => {
    const storeCorners = [{ x: 80, y: 20 }];
    expect(
      resolveStepCorners({
        layoutPoints: undefined,
        storeCorners,
        source,
        target,
        sourcePosition: Position.Right,
      }),
    ).toBe(storeCorners);
  });

  it("prefers stamped curve points including empty arrays", () => {
    expect(
      resolveCurvePoints({
        layoutPoints: [{ id: "p", x: 1, y: 2 }],
        storePoints: [{ id: "s", x: 9, y: 9 }],
      }),
    ).toEqual([{ id: "p", x: 1, y: 2 }]);
    expect(
      resolveCurvePoints({
        layoutPoints: [],
        storePoints: [{ id: "s", x: 9, y: 9 }],
      }),
    ).toEqual([]);
  });

  it("resolves label offset stamp → store → legacy", () => {
    expect(
      resolveLabelOffset({
        layoutLabelOffset: 0.2,
        storeLabelOffset: 0.5,
        legacyLabelPosition: 0.8,
      }),
    ).toBe(0.2);
    expect(
      resolveLabelOffset({
        layoutLabelOffset: undefined,
        storeLabelOffset: 0.5,
        legacyLabelPosition: 0.8,
      }),
    ).toBe(0.5);
    expect(
      resolveLabelOffset({
        layoutLabelOffset: undefined,
        storeLabelOffset: undefined,
        legacyLabelPosition: 0.8,
      }),
    ).toBe(0.8);
  });

  it("builds the step path from stamped corners when selection is off", () => {
    const corners = resolveStepCorners({
      layoutPoints: [
        { id: "a", x: 100, y: 10 },
        { id: "b", x: 100, y: 90 },
      ],
      storeCorners: [],
      source,
      target,
      sourcePosition: Position.Right,
    });
    const path = buildStepPath(source, target, corners);
    expect(path).toContain("100");
    expect(path.startsWith("M")).toBe(true);
  });
});
