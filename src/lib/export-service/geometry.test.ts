import { describe, expect, it } from "vitest";
import { PanelKind, type Component } from "@/features/diagram";
import type { NodeLayout } from "@/features/diagram";
import { computeBoundingBox, isRootExportNode } from "./geometry";

function layout(x: number, y: number, w?: number, h?: number): NodeLayout {
  return {
    elementId: "x",
    x,
    y,
    ...(w !== undefined ? { width: w } : {}),
    ...(h !== undefined ? { height: h } : {}),
  };
}

describe("computeBoundingBox", () => {
  it("uses only root nodes for extents", () => {
    const components: Record<string, Component> = {
      p: {
        id: "p",
        name: "P",
        type: "panel",
        panelKind: PanelKind.Default,
        description: "",
        parentId: null,
      },
      c: { id: "c", name: "C", type: "system", description: "", parentId: "p" },
    };
    const containerIds = new Set<string>(["p"]);
    const map = new Map<string, NodeLayout>([
      ["p", layout(100, 200, 400, 300)],
      ["c", layout(40, 50, 240, 120)],
    ]);
    const bb = computeBoundingBox(["p", "c"], map, components, containerIds);
    expect(bb.minX).toBe(100);
    expect(bb.minY).toBe(200);
    expect(bb.width).toBe(400);
    expect(bb.height).toBe(300);
  });
});

describe("isRootExportNode", () => {
  it("treats nodes inside containers as non-root", () => {
    const containerIds = new Set(["p"]);
    expect(isRootExportNode({ id: "c", parentId: "p" } as Component, containerIds)).toBe(false);
    expect(isRootExportNode({ id: "p", parentId: null } as Component, containerIds)).toBe(true);
  });
});
