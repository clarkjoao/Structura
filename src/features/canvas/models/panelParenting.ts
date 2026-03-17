import type { Node } from "@xyflow/react";
import { isPanelType } from "@/features/diagram";
import { PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "../constants";

export function getPanelDimensions(node: Node): { width: number; height: number } {
  const w = (node.style?.width as number) ?? PANEL_DEFAULT_W;
  const h = (node.style?.height as number) ?? PANEL_DEFAULT_H;
  return { width: w, height: h };
}

export function isInsidePanel(node: Node, x: number, y: number): boolean {
  const { width, height } = getPanelDimensions(node);
  return (
    x > node.position.x &&
    y > node.position.y &&
    x < node.position.x + width &&
    y < node.position.y + height
  );
}

export function isOutsideParentBounds(
  childPos: { x: number; y: number },
  parent: Node,
): boolean {
  const { width, height } = getPanelDimensions(parent);
  return (
    childPos.x < 0 ||
    childPos.y < 0 ||
    childPos.x > width ||
    childPos.y > height
  );
}

export function findPanelContainingPoint(
  nodes: Node[],
  absX: number,
  absY: number,
  excludeParentId?: string | null,
): Node | undefined {
  const panels = nodes.filter(
    (n) => isPanelType(n.type as string) && n.id !== excludeParentId,
  );
  return panels.find((p) => isInsidePanel(p, absX, absY));
}

export function toAbsolutePosition(
  relativePos: { x: number; y: number },
  parentLayout: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: relativePos.x + parentLayout.x,
    y: relativePos.y + parentLayout.y,
  };
}

export function toRelativePosition(
  absPos: { x: number; y: number },
  parentPos: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: absPos.x - parentPos.x,
    y: absPos.y - parentPos.y,
  };
}
