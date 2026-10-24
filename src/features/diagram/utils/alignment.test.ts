import { describe, expect, it } from "vitest";
import {
  alignBoxes,
  distributeBoxes,
  parentOrigin,
  selectionRoots,
  type AlignBox,
} from "./alignment";

const box = (
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50,
  locked = false,
): AlignBox => ({
  id,
  x,
  y,
  width,
  height,
  locked,
});

describe("alignBoxes", () => {
  const boxes = [box("a", 0, 0, 100, 50), box("b", 200, 100, 60, 30), box("c", 50, 300, 80, 80)];

  it("aligns to the left edge of the leftmost", () => {
    const out = alignBoxes(boxes, "left");
    expect(out.get("b")).toEqual({ x: 0, y: 100 });
    expect(out.get("c")).toEqual({ x: 0, y: 300 });
    expect(out.has("a")).toBe(false);
  });

  it("aligns to the right edge of the rightmost", () => {
    const out = alignBoxes(boxes, "right");
    // right = max(100, 260, 130) = 260
    expect(out.get("a")).toEqual({ x: 160, y: 0 });
    expect(out.get("c")).toEqual({ x: 180, y: 300 });
    expect(out.has("b")).toBe(false);
  });

  it("centres on the selection's horizontal middle", () => {
    const out = alignBoxes(boxes, "center-h");
    // left 0, right 260 → middle 130
    expect(out.get("a")).toEqual({ x: 80, y: 0 });
    expect(out.get("b")).toEqual({ x: 100, y: 100 });
    expect(out.get("c")).toEqual({ x: 90, y: 300 });
  });

  it("aligns top, bottom and vertical centre", () => {
    expect(alignBoxes(boxes, "top").get("c")).toEqual({ x: 50, y: 0 });
    // bottom = 380
    expect(alignBoxes(boxes, "bottom").get("a")).toEqual({ x: 0, y: 330 });
    // top 0, bottom 380 → middle 190
    expect(alignBoxes(boxes, "center-v").get("b")).toEqual({ x: 200, y: 175 });
  });

  it("leaves a locked node where it is but still aligns to it", () => {
    const out = alignBoxes([box("a", 500, 0, 100, 50, true), box("b", 0, 100)], "right");
    expect(out.has("a")).toBe(false);
    expect(out.get("b")).toEqual({ x: 500, y: 100 });
  });

  it("does nothing for fewer than two", () => {
    expect(alignBoxes([box("a", 0, 0)], "left").size).toBe(0);
  });
});

describe("distributeBoxes", () => {
  it("makes the gaps equal and keeps the outer two", () => {
    const out = distributeBoxes(
      [box("a", 0, 0, 100), box("b", 120, 0, 100), box("c", 400, 0, 100)],
      "horizontal",
    );
    // span 500, occupied 300, gap 100 → b at 200
    expect(out.get("b")).toEqual({ x: 200, y: 0 });
    expect(out.has("a")).toBe(false);
    expect(out.has("c")).toBe(false);
  });

  it("distributes vertically, whatever the input order", () => {
    const out = distributeBoxes(
      [box("c", 0, 300, 10, 50), box("a", 0, 0, 10, 50), box("b", 0, 60, 10, 50)],
      "vertical",
    );
    // span 350, occupied 150, gap 100 → b at 150
    expect(out.get("b")).toEqual({ x: 0, y: 150 });
  });

  it("needs three nodes", () => {
    expect(distributeBoxes([box("a", 0, 0), box("b", 500, 0)], "horizontal").size).toBe(0);
  });
});

describe("selectionRoots / parentOrigin", () => {
  const parents: Record<string, string | null> = {
    child: "panel",
    panel: "outer",
    outer: null,
    solo: null,
  };
  const parentOf = (id: string) => parents[id] ?? null;

  it("drops a node whose ancestor is selected too", () => {
    expect(selectionRoots(["child", "panel", "solo"], parentOf)).toEqual(["panel", "solo"]);
    expect(selectionRoots(["child", "solo"], parentOf)).toEqual(["child", "solo"]);
  });

  it("sums the ancestors' layouts into the origin a child's layout is relative to", () => {
    const layouts: Record<string, { x: number; y: number }> = {
      panel: { x: 10, y: 20 },
      outer: { x: 100, y: 200 },
    };
    expect(parentOrigin("child", parentOf, (id) => layouts[id])).toEqual({ x: 110, y: 220 });
    expect(parentOrigin("solo", parentOf, (id) => layouts[id])).toEqual({ x: 0, y: 0 });
  });
});
