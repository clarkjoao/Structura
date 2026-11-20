import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { kindPlacedOverlay } from "./nodeOverlays";

const node: Node = { id: "n", position: { x: 0, y: 0 }, data: {}, draggable: true };

describe("kindPlacedOverlay", () => {
  it("takes drag (and, by class, resize) away from a node a kind places", () => {
    const placed = kindPlacedOverlay(node, true);
    expect(placed.draggable).toBe(false);
    expect(placed.className).toContain("kind-placed");
    expect(placed.selectable).not.toBe(false);
    expect(placed.connectable).not.toBe(false);
  });

  it("leaves a freehand node as it was", () => {
    expect(kindPlacedOverlay(node, false)).toBe(node);
  });
});
