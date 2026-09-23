import type { Node } from "@xyflow/react";
import { computeFitBounds } from "@/features/diagram/utils/fit-group-to-children";
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
 * "Fit to content" (`fitGroupToChildren`) over every container of a layout run,
 * so an auto-layout leaves each panel wrapped the way the panel's own button
 * would. Innermost containers go first: an outer panel wraps the box its inner
 * one ends up with. A container's children keep their place on the canvas —
 * they move by the opposite of what the container moves — so the routes the
 * layout computed between them still land where they were drawn.
 *
 * A child with no size of its own in `applied` is measured by the box the
 * layout gave it (`graph`), the size the engine actually placed.
 */
export function fitContainersToChildren(
  applied: readonly AppliedLayout[],
  graph: LayoutGraph,
  containers: ReadonlySet<string>,
): AppliedLayout[] {
  const byId = new Map(applied.map((entry) => [entry.elementId, { ...entry }]));
  const present = new Set(graph.nodes.map((node) => node.id));
  const graphNode = new Map(graph.nodes.map((node) => [node.id, node]));

  const childrenOf = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.parentId === null || !present.has(node.parentId)) continue;
    const siblings = childrenOf.get(node.parentId) ?? [];
    siblings.push(node.id);
    childrenOf.set(node.parentId, siblings);
  }

  const depthOf = (id: string): number => {
    let depth = 0;
    let parentId = graphNode.get(id)?.parentId ?? null;
    while (parentId !== null && present.has(parentId)) {
      depth++;
      parentId = graphNode.get(parentId)?.parentId ?? null;
    }
    return depth;
  };

  const innermostFirst = [...containers]
    .filter((id) => byId.has(id) && (childrenOf.get(id)?.length ?? 0) > 0)
    .sort((a, b) => depthOf(b) - depthOf(a));

  for (const containerId of innermostFirst) {
    const children = childrenOf.get(containerId)!.flatMap((childId) => {
      const entry = byId.get(childId);
      const node = graphNode.get(childId);
      if (!entry || !node) return [];
      return [{ ...entry, width: entry.width ?? node.width, height: entry.height ?? node.height }];
    });
    const bounds = computeFitBounds(children);
    if (!bounds) continue;

    for (const child of children) {
      const entry = byId.get(child.elementId)!;
      entry.x -= bounds.x;
      entry.y -= bounds.y;
    }
    const container = byId.get(containerId)!;
    container.x += bounds.x;
    container.y += bounds.y;
    container.width = bounds.width;
    container.height = bounds.height;
  }

  return applied.map((entry) => byId.get(entry.elementId)!);
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
