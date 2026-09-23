import { describe, expect, it } from "vitest";
import { NODE_DRAG_PADDING } from "@/features/diagram/model/layout.constants";
import { fitContainersToChildren, type AppliedLayout } from "./applyLayout";
import type { LayoutGraph } from "./contract";

/**
 * `fitContainersToChildren` is "Fit to content" run over a whole layout result,
 * so Cmd/Ctrl+Shift+L leaves every panel wrapped the way its own button would.
 */

const P = NODE_DRAG_PADDING;

function byId(applied: AppliedLayout[]): Record<string, AppliedLayout> {
  return Object.fromEntries(applied.map((entry) => [entry.elementId, entry]));
}

/** Where a node sits on the canvas: its own position plus every ancestor's. */
function absolute(
  id: string,
  graph: LayoutGraph,
  layouts: Record<string, AppliedLayout>,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current: string | null = id;
  while (current !== null) {
    x += layouts[current]!.x;
    y += layouts[current]!.y;
    current = graph.nodes.find((node) => node.id === current)?.parentId ?? null;
  }
  return { x, y };
}

describe("fitContainersToChildren", () => {
  const graph: LayoutGraph = {
    nodes: [
      { id: "outer", parentId: null, width: 900, height: 700 },
      { id: "inner", parentId: "outer", width: 500, height: 400 },
      { id: "a", parentId: "inner", width: 180, height: 80 },
      { id: "b", parentId: "inner", width: 200, height: 90 },
      { id: "c", parentId: "outer", width: 180, height: 80 },
    ],
    edges: [],
  };
  // What the engine hands back: containers larger than their content.
  const applied: AppliedLayout[] = [
    { elementId: "outer", x: 100, y: 50, width: 900, height: 700 },
    { elementId: "inner", x: 60, y: 60, width: 500, height: 400 },
    { elementId: "a", x: 70, y: 90 },
    { elementId: "b", x: 330, y: 90 },
    { elementId: "c", x: 620, y: 100 },
  ];

  it("wraps each container around its children with the Fit-to-content padding", () => {
    const fitted = byId(fitContainersToChildren(applied, graph, new Set(["outer", "inner"])));

    // inner: children span x 70..530, y 90..180.
    expect(fitted.inner!.width).toBe(530 - 70 + P * 2);
    expect(fitted.inner!.height).toBe(180 - 90 + P * 3);
    expect([fitted.a!.x, fitted.a!.y]).toEqual([P, P]);

    // outer wraps the box inner ends up with, not the one the engine gave it.
    const innerRight = fitted.inner!.x + fitted.inner!.width!;
    const innerBottom = fitted.inner!.y + fitted.inner!.height!;
    const minX = Math.min(fitted.inner!.x, fitted.c!.x);
    const minY = Math.min(fitted.inner!.y, fitted.c!.y);
    expect(fitted.outer!.width).toBe(Math.max(innerRight, fitted.c!.x + 180) - minX + P * 2);
    expect(fitted.outer!.height).toBe(Math.max(innerBottom, fitted.c!.y + 80) - minY + P * 3);
  });

  it("leaves every leaf where it was on the canvas", () => {
    const before = byId(applied);
    const after = byId(fitContainersToChildren(applied, graph, new Set(["outer", "inner"])));
    for (const id of ["a", "b", "c"]) {
      expect(absolute(id, graph, after)).toEqual(absolute(id, graph, before));
    }
  });

  it("does not touch a container it was not asked to fit", () => {
    const fitted = byId(fitContainersToChildren(applied, graph, new Set(["inner"])));
    expect(fitted.outer).toEqual(applied[0]);
  });

  it("does not mutate its input", () => {
    const copy = structuredClone(applied);
    fitContainersToChildren(applied, graph, new Set(["outer", "inner"]));
    expect(applied).toEqual(copy);
  });
});
