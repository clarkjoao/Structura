import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { Component, NodeLayout } from "@/features/diagram";
import {
  buildGesturePanelIndex,
  findPanelInIndex,
  findPanelContainingPoint,
  resolveAbsoluteFromIndex,
  resolveAbsolutePosition,
} from "./panelParenting";

/**
 * Three nested panels, the shape the product has to support:
 *
 *   P0  root          abs (100,100)  1000x800
 *   P1  child of P0   rel  (50,50)   -> abs (150,150)  500x400
 *   P2  child of P1   rel  (20,20)   -> abs (170,170)  200x150
 */
function panelNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  parentId?: string,
): Node {
  return {
    id,
    type: "panel",
    position: { x, y },
    data: {},
    style: { width: w, height: h },
    ...(parentId ? { parentId, extent: "parent" as const } : {}),
  };
}

function leafNode(id: string, x: number, y: number, parentId?: string): Node {
  return {
    id,
    type: "c4",
    position: { x, y },
    data: {},
    ...(parentId ? { parentId, extent: "parent" as const } : {}),
  };
}

function fixture() {
  const nodes: Node[] = [
    panelNode("P0", 100, 100, 1000, 800),
    panelNode("P1", 50, 50, 500, 400, "P0"),
    panelNode("P2", 20, 20, 200, 150, "P1"),
    leafNode("leaf-root", 2000, 2000),
    leafNode("leaf-in-P2", 10, 10, "P2"),
  ];
  const components = {
    P0: { id: "P0", name: "P0", type: "panel", parentId: null },
    P1: { id: "P1", name: "P1", type: "panel", parentId: "P0" },
    P2: { id: "P2", name: "P2", type: "panel", parentId: "P1" },
    "leaf-root": { id: "leaf-root", name: "l", type: "container", parentId: null },
    "leaf-in-P2": { id: "leaf-in-P2", name: "l2", type: "container", parentId: "P2" },
  } as unknown as Record<string, Component>;
  const nodeLayouts: Record<string, NodeLayout> = {
    P0: { elementId: "P0", x: 100, y: 100, width: 1000, height: 800 },
    P1: { elementId: "P1", x: 50, y: 50, width: 500, height: 400 },
    P2: { elementId: "P2", x: 20, y: 20, width: 200, height: 150 },
    "leaf-root": { elementId: "leaf-root", x: 2000, y: 2000 },
    "leaf-in-P2": { elementId: "leaf-in-P2", x: 10, y: 10 },
  };
  return { nodes, components, nodeLayouts };
}

describe("gesture panel index", () => {
  it("resolves absolute positions through three levels, agreeing with resolveAbsolutePosition", () => {
    const { nodes, components, nodeLayouts } = fixture();
    const index = buildGesturePanelIndex(nodes, components, nodeLayouts);

    expect(index.absoluteById.get("P0")).toEqual({ x: 100, y: 100 });
    expect(index.absoluteById.get("P1")).toEqual({ x: 150, y: 150 });
    expect(index.absoluteById.get("P2")).toEqual({ x: 170, y: 170 });

    // the single authority must agree with the index, level by level
    for (const id of ["P0", "P1", "P2"]) {
      const layout = nodeLayouts[id];
      expect(index.absoluteById.get(id)).toEqual(
        resolveAbsolutePosition(id, { x: layout.x, y: layout.y }, components, nodeLayouts),
      );
    }
  });

  it("returns the smallest panel containing the point", () => {
    const { nodes, components, nodeLayouts } = fixture();
    const index = buildGesturePanelIndex(nodes, components, nodeLayouts);

    // inside P2 (and therefore inside P1 and P0 too) -> P2 wins
    expect(findPanelInIndex(index, 200, 200)?.id).toBe("P2");
    // inside P1 but right of P2 -> P1
    expect(findPanelInIndex(index, 500, 200)?.id).toBe("P1");
    // inside P0 but below P1 -> P0
    expect(findPanelInIndex(index, 500, 700)?.id).toBe("P0");
    // outside everything
    expect(findPanelInIndex(index, 5000, 5000)).toBeUndefined();
  });

  it("honours excludeParentId without hiding the other panels", () => {
    const { nodes, components, nodeLayouts } = fixture();
    const index = buildGesturePanelIndex(nodes, components, nodeLayouts);
    // a child of P2 dragged inside its own parent must fall through to P1
    expect(findPanelInIndex(index, 200, 200, "P2")?.id).toBe("P1");
  });

  it("omits excluded ids entirely (a dragged panel and its descendants)", () => {
    const { nodes, components, nodeLayouts } = fixture();
    const index = buildGesturePanelIndex(nodes, components, nodeLayouts, new Set(["P1", "P2"]));
    expect(index.panels.map((p) => p.id)).toEqual(["P0"]);
    expect(findPanelInIndex(index, 200, 200)?.id).toBe("P0");
  });

  it("matches findPanelContainingPoint on every probe point (behaviour freeze)", () => {
    const { nodes, components, nodeLayouts } = fixture();
    const index = buildGesturePanelIndex(nodes, components, nodeLayouts);
    const probes = [
      [200, 200],
      [500, 200],
      [500, 700],
      [160, 160],
      [1050, 850],
      [5000, 5000],
      [101, 101],
      [340, 300],
    ] as const;
    for (const [x, y] of probes) {
      const legacy = findPanelContainingPoint(nodes, x, y, undefined, nodeLayouts, components);
      const viaIndex = findPanelInIndex(index, x, y);
      expect(viaIndex?.id).toBe(legacy?.id);
    }
    // and with an excluded parent
    for (const [x, y] of probes) {
      const legacy = findPanelContainingPoint(nodes, x, y, "P2", nodeLayouts, components);
      const viaIndex = findPanelInIndex(index, x, y, "P2");
      expect(viaIndex?.id).toBe(legacy?.id);
    }
  });

  it("resolves a child's absolute position from its parent without walking the node array", () => {
    const { nodes, components, nodeLayouts } = fixture();
    const index = buildGesturePanelIndex(nodes, components, nodeLayouts);
    // leaf-in-P2 sits at rel (10,10) inside P2 which is at abs (170,170)
    expect(resolveAbsoluteFromIndex(index, "P2", { x: 10, y: 10 })).toEqual({ x: 180, y: 180 });
    // a root-level node keeps its own position
    expect(resolveAbsoluteFromIndex(index, null, { x: 2000, y: 2000 })).toEqual({
      x: 2000,
      y: 2000,
    });
    expect(resolveAbsoluteFromIndex(index, undefined, { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
  });
});
