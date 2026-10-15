import { describe, expect, it } from "vitest";
import { computeFitBounds } from "./fit-group-to-children";
import { NODE_DRAG_PADDING, panelTopInset } from "../model/layout.constants";

const child = { elementId: "a", x: 100, y: 200, width: 180, height: 80 };

describe("panelTopInset", () => {
  it("reserves the header plus a gap, and one more line for a description", () => {
    expect(panelTopInset()).toBe(56);
    expect(panelTopInset("   ")).toBe(56);
    expect(panelTopInset("what this group is")).toBe(72);
  });
});

describe("computeFitBounds", () => {
  it("keeps the side padding as the default top inset", () => {
    const b = computeFitBounds([child])!;
    expect(b.y).toBe(200 - NODE_DRAG_PADDING);
    expect(b.height).toBe(80 + NODE_DRAG_PADDING * 3);
  });

  it("opens the top by the given inset and grows the height by the same amount", () => {
    const inset = panelTopInset("desc");
    const b = computeFitBounds([child], inset)!;
    expect(b.y).toBe(200 - inset);
    expect(b.height).toBe(80 + inset + NODE_DRAG_PADDING * 2);
  });
});
