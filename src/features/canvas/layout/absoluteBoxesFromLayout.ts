import type { LayoutGraph, LayoutResult } from "./contract";

export interface AbsoluteLayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Absolute canvas boxes from a layout result (boxes in the result are
 * parent-relative). Optional overrides replace a node's own x/y contribution —
 * used when panel-child layout keeps the panel where the user dragged it.
 */
export function absoluteBoxesFromLayout(
  graph: LayoutGraph,
  result: LayoutResult,
  positionOverrides?: Map<string, { x: number; y: number }>,
): Map<string, AbsoluteLayoutBox> {
  const parentOf = new Map(graph.nodes.map((node) => [node.id, node.parentId] as const));
  const present = new Set(graph.nodes.map((node) => node.id));
  const absolute = new Map<string, AbsoluteLayoutBox>();

  const resolve = (id: string, seen: Set<string>): AbsoluteLayoutBox | null => {
    const cached = absolute.get(id);
    if (cached) return cached;
    const box = result.boxes.get(id);
    if (!box || seen.has(id)) return null;
    seen.add(id);

    const override = positionOverrides?.get(id);
    const localX = override?.x ?? box.x;
    const localY = override?.y ?? box.y;

    const parentId = parentOf.get(id) ?? null;
    if (parentId === null || !present.has(parentId)) {
      const abs = { x: localX, y: localY, width: box.width, height: box.height };
      absolute.set(id, abs);
      return abs;
    }

    const parent = resolve(parentId, seen);
    if (!parent) {
      const abs = { x: localX, y: localY, width: box.width, height: box.height };
      absolute.set(id, abs);
      return abs;
    }

    const abs = {
      x: parent.x + localX,
      y: parent.y + localY,
      width: box.width,
      height: box.height,
    };
    absolute.set(id, abs);
    return abs;
  };

  for (const node of graph.nodes) {
    resolve(node.id, new Set());
  }

  return absolute;
}
