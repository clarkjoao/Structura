import type { Node } from "@xyflow/react";
import type { LayoutGraph, LayoutPoint, LayoutResult } from "./contract";

/**
 * The three small steps every consumer of `layout()` repeats, in one place so
 * they cannot drift apart the way the two engines did.
 */

/** One entry per node, sized only where the caller says the node is resizable. */
export interface AppliedLayout {
  elementId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Turns a layout result into what `applyAutoLayout` writes.
 *
 * `resizable` is the set of ids whose size should be stored — containers, whose
 * box has to hold what the layout put inside them. Everything else keeps the
 * size it derives from its own content, so no width is emitted for it.
 *
 * `offset` moves the whole result, for a caller placing it somewhere specific.
 * It is added to root nodes only: a child's position is relative to its parent,
 * so shifting the parent already moves it, and shifting both moves it twice.
 */
export function toAppliedLayouts(
  graph: LayoutGraph,
  result: LayoutResult,
  resizable: ReadonlySet<string>,
  offset: { x: number; y: number } = { x: 0, y: 0 },
): AppliedLayout[] {
  const present = new Set(graph.nodes.map((node) => node.id));
  const isRoot = new Map(
    graph.nodes.map((node) => [node.id, node.parentId === null || !present.has(node.parentId)]),
  );

  const applied: AppliedLayout[] = [];

  for (const [elementId, box] of result.boxes) {
    const shift = isRoot.get(elementId) === true ? offset : { x: 0, y: 0 };
    applied.push({
      elementId,
      x: box.x + shift.x,
      y: box.y + shift.y,
      ...(resizable.has(elementId) ? { width: box.width, height: box.height } : {}),
    });
  }

  return applied;
}

/**
 * Interior bend points of a route, in canvas coordinates.
 *
 * The first and last entries sit on the node borders; the canvas draws those
 * legs from the handles instead, so only what is between them becomes control
 * points.
 */
export function interiorWaypoints(
  route: readonly LayoutPoint[] | undefined,
  offset: { x: number; y: number } = { x: 0, y: 0 },
): LayoutPoint[] {
  if (route === undefined || route.length <= 2) return [];
  return route.slice(1, -1).map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
}

/** Sizes React Flow measured from the DOM, keyed by node id. */
export function measuredSizesOf(
  nodes: readonly Node[],
): Map<string, { width: number; height: number }> {
  const measured = new Map<string, { width: number; height: number }>();

  for (const node of nodes) {
    const width = node.measured?.width;
    const height = node.measured?.height;
    if (width !== undefined && height !== undefined && width > 0 && height > 0) {
      measured.set(node.id, { width, height });
    }
  }

  return measured;
}
