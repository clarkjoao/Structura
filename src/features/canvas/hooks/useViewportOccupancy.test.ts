import { describe, expect, it } from "vitest";
import type { InternalNode, Node } from "@xyflow/react";
import { computeViewportOccupancy } from "./useViewportOccupancy";

function node(
  id: string,
  x: number,
  y: number,
  overrides: { width?: number; height?: number; hidden?: boolean } = {},
): InternalNode<Node> {
  return {
    id,
    position: { x, y },
    data: {},
    hidden: overrides.hidden,
    measured: { width: overrides.width ?? 180, height: overrides.height ?? 80 },
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userNode: { id, position: { x, y }, data: {} },
    },
  } as unknown as InternalNode<Node>;
}

/** A 1000x800 pane showing flow coordinates (0,0)-(1000,800) at zoom 1. */
const IDENTITY: [number, number, number] = [0, 0, 1];
const PANE_W = 1000;
const PANE_H = 800;

describe("computeViewportOccupancy", () => {
  it("reports an empty diagram as having no nodes", () => {
    expect(computeViewportOccupancy([], IDENTITY, PANE_W, PANE_H)).toEqual({
      hasNodes: false,
      anyNodeVisible: false,
      nodeCount: 0,
    });
  });

  it("sees a node inside the viewport", () => {
    const result = computeViewportOccupancy([node("a", 100, 100)], IDENTITY, PANE_W, PANE_H);

    expect(result).toEqual({ hasNodes: true, anyNodeVisible: true, nodeCount: 1 });
  });

  it("does not see a node far off to the right", () => {
    const result = computeViewportOccupancy([node("a", 5000, 100)], IDENTITY, PANE_W, PANE_H);

    expect(result).toEqual({ hasNodes: true, anyNodeVisible: false, nodeCount: 1 });
  });

  it("does not see a node far above", () => {
    const result = computeViewportOccupancy([node("a", 100, -4000)], IDENTITY, PANE_W, PANE_H);

    expect(result.anyNodeVisible).toBe(false);
  });

  it("counts a partially overlapping node as visible", () => {
    // Straddles the left edge: x from -90 to 90.
    const result = computeViewportOccupancy([node("a", -90, 100)], IDENTITY, PANE_W, PANE_H);

    expect(result.anyNodeVisible).toBe(true);
  });

  it("is visible when any one of several nodes overlaps", () => {
    const result = computeViewportOccupancy(
      [node("far", 9000, 9000), node("near", 10, 10)],
      IDENTITY,
      PANE_W,
      PANE_H,
    );

    expect(result).toEqual({ hasNodes: true, anyNodeVisible: true, nodeCount: 2 });
  });

  it("ignores hidden nodes", () => {
    const result = computeViewportOccupancy(
      [node("hidden", 10, 10, { hidden: true })],
      IDENTITY,
      PANE_W,
      PANE_H,
    );

    expect(result).toEqual({ hasNodes: false, anyNodeVisible: false, nodeCount: 0 });
  });

  it("accounts for the pan offset", () => {
    // Panning right by 4000px puts flow x ~4000..5000 on screen.
    const result = computeViewportOccupancy([node("a", 4200, 100)], [-4000, 0, 1], PANE_W, PANE_H);

    expect(result.anyNodeVisible).toBe(true);
  });

  it("accounts for zoom widening the visible area", () => {
    // At zoom 0.5 the same pane shows twice the flow area.
    const zoomedOut = computeViewportOccupancy([node("a", 1500, 100)], [0, 0, 0.5], PANE_W, PANE_H);
    const atOne = computeViewportOccupancy([node("a", 1500, 100)], IDENTITY, PANE_W, PANE_H);

    expect(zoomedOut.anyNodeVisible).toBe(true);
    expect(atOne.anyNodeVisible).toBe(false);
  });

  it("assumes content is reachable before the pane is measured", () => {
    const result = computeViewportOccupancy([node("a", 9000, 9000)], IDENTITY, 0, 0);

    expect(result).toEqual({ hasNodes: true, anyNodeVisible: true, nodeCount: 1 });
  });

  it("falls back to the default node size when unmeasured", () => {
    const unmeasured = {
      ...node("a", 990, 100),
      measured: {},
    } as unknown as InternalNode<Node>;

    // x 990..1170 still touches the right edge at 1000.
    expect(computeViewportOccupancy([unmeasured], IDENTITY, PANE_W, PANE_H).anyNodeVisible).toBe(
      true,
    );
  });
});
