import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { kindBadgeOverlay, kindPlacedOverlay } from "./nodeOverlays";

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

describe("kindBadgeOverlay", () => {
  it("puts the kind's badge on the node as data attributes, keeping its own", () => {
    const withAttr = { ...node, domAttributes: { "data-testid": "x" } } as Node;
    const badged = kindBadgeOverlay(withAttr, { text: "😞 1", tone: "danger" });
    expect(badged.domAttributes).toMatchObject({
      "data-testid": "x",
      "data-kind-badge": "😞 1",
      "data-kind-badge-tone": "danger",
    });
  });
});
