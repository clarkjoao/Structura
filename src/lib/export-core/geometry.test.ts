import { describe, expect, it } from "vitest";
import { computeCompensationOffsets } from "./geometry";
import type { ExportNode } from "./model";

function c4(id: string, x: number, y: number): ExportNode {
  return {
    kind: "c4",
    id,
    parentId: null,
    x,
    y,
    width: 0,
    height: 0,
    subtype: "person",
    name: id,
    description: "",
  } as ExportNode;
}

describe("computeCompensationOffsets", () => {
  it("pushes stacked nodes apart when canonical boxes collide", () => {
    // Person1 at y=0 (bottom=70), Person2 at y=75 (top=75, bottom=145).
    // They overlap by 5px. Push = other.maxY + GAP - my.minY = 70+10-75 = 5.
    const nodes = [c4("a", 0, 0), c4("b", 0, 75)];
    const offsets = computeCompensationOffsets(nodes, new Set());
    expect(offsets.get("a")).toBeUndefined();
    expect(offsets.get("b")).toBe(5); // push down by 5px
  });

  it("does not push nodes with no overlap", () => {
    const nodes = [c4("a", 0, 0), c4("b", 0, 200)]; // gap = 130, > 10
    const offsets = computeCompensationOffsets(nodes, new Set());
    expect(offsets.size).toBe(0);
  });

  it("cascades: three stacked nodes each pushed by previous", () => {
    const nodes = [c4("a", 0, 0), c4("b", 0, 75), c4("c", 0, 150)];
    const offsets = computeCompensationOffsets(nodes, new Set());
    expect(offsets.get("a")).toBeUndefined();
    // B: push = 70+10-75 = 5 → B placed at (80)-(150)
    expect(offsets.get("b")).toBe(5);
    // C: collides with B (placed at 80-150). C.minY=150 < B.maxY=150 (touch).
    // push = B.maxY + GAP - C.minY = 150+10-150 = 10
    expect(offsets.get("c")).toBe(10);
  });
});
