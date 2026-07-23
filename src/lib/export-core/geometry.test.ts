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
    // Person1 at y=0 (bottom=120), Person2 at y=75 (top=75, bottom=195).
    // They overlap by 45px. Push = other.maxY + GAP - my.minY = 120+10-75 = 55.
    const nodes = [c4("a", 0, 0), c4("b", 0, 75)];
    const offsets = computeCompensationOffsets(nodes, new Set());
    expect(offsets.get("a")).toBeUndefined();
    expect(offsets.get("b")).toBe(55); // push down by 55px
  });

  it("does not push nodes with no overlap", () => {
    const nodes = [c4("a", 0, 0), c4("b", 0, 200)]; // gap = 80, > 10
    const offsets = computeCompensationOffsets(nodes, new Set());
    expect(offsets.size).toBe(0);
  });

  it("cascades: three stacked nodes each pushed by previous", () => {
    const nodes = [c4("a", 0, 0), c4("b", 0, 75), c4("c", 0, 150)];
    const offsets = computeCompensationOffsets(nodes, new Set());
    expect(offsets.get("a")).toBeUndefined();
    // B: push = 120+10-75 = 55 → B placed at (130)-(250)
    expect(offsets.get("b")).toBe(55);
    // C: collides with B (placed at 130-250). C.minY=150 < B.maxY=250.
    // push = B.maxY + GAP - C.minY = 250+10-150 = 110
    expect(offsets.get("c")).toBe(110);
  });
});
