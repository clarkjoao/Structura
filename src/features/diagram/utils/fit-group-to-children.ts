import type { NodeLayout } from "../model/layout.types";
import { DEFAULT_NODE_W, DEFAULT_NODE_H, NODE_DRAG_PADDING } from "../model/layout.constants";

export function computeFitBounds(
  childLayouts: NodeLayout[],
): { x: number; y: number; width: number; height: number } | null {
  if (childLayouts.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const layout of childLayouts) {
    const w = layout.width ?? DEFAULT_NODE_W;
    const h = layout.height ?? DEFAULT_NODE_H;
    minX = Math.min(minX, layout.x);
    minY = Math.min(minY, layout.y);
    maxX = Math.max(maxX, layout.x + w);
    maxY = Math.max(maxY, layout.y + h);
  }

  return {
    x: minX - NODE_DRAG_PADDING,
    y: minY - NODE_DRAG_PADDING,
    width: maxX - minX + NODE_DRAG_PADDING * 2,
    height: maxY - minY + NODE_DRAG_PADDING * 3,
  };
}
