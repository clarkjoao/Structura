import { describe, expect, it, vi } from "vitest";
import { getViewportForBounds } from "@xyflow/react";
import type { KindOverlay } from "@/features/diagram-kinds/kind.types";
import { frameDiagram } from "./frameDiagram";

const pane = { width: 1000, height: 600, minZoom: 0.1, maxZoom: 2 };

function instance() {
  return {
    fitView: vi.fn(async () => true),
    getNodes: vi.fn(() => [{ id: "a" }, { id: "h", hidden: true }]),
    getNodesBounds: vi.fn(() => ({ x: 0, y: 0, width: 400, height: 300 })),
    setViewport: vi.fn(async () => true),
  };
}

const overlay: KindOverlay = {
  axis: "x",
  at: -120,
  depth: 36,
  segments: [{ id: "p", label: "P", from: 50, to: 600 }],
  separators: [],
  curve: [],
};

describe("frameDiagram", () => {
  it("is React Flow's fit when there is no overlay", async () => {
    const rf = instance();
    // @ts-expect-error a partial instance is enough for the helper
    await frameDiagram(rf, pane, null, { padding: 0.2, duration: 400 });
    expect(rf.fitView).toHaveBeenCalledWith({ padding: 0.2, duration: 400 });
    expect(rf.setViewport).not.toHaveBeenCalled();
  });

  it("frames the nodes and the band together", async () => {
    const rf = instance();
    // @ts-expect-error a partial instance is enough for the helper
    await frameDiagram(rf, pane, overlay, { padding: 0.2, maxZoom: 1.5, duration: 0 });
    expect(rf.fitView).not.toHaveBeenCalled();
    expect(rf.getNodesBounds).toHaveBeenCalledWith([{ id: "a" }]);
    const union = { x: 0, y: -120, width: 600, height: 420 };
    expect(rf.setViewport).toHaveBeenCalledWith(
      getViewportForBounds(union, 1000, 600, 0.1, 1.5, 0.2),
      { duration: 0 },
    );
  });
});
