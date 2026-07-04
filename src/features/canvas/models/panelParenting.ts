import type { Node } from "@xyflow/react";
import type { Component, NodeLayout } from "@/features/diagram";
import { isReactFlowParentPanelType } from "@/features/diagram";
import { PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "../canvas.constants";

export function getPanelDimensions(node: Node): { width: number; height: number } {
  const widthFromStyle = typeof node.style?.width === "number" ? node.style.width : undefined;
  const heightFromStyle = typeof node.style?.height === "number" ? node.style.height : undefined;
  const w = widthFromStyle ?? node.measured?.width ?? PANEL_DEFAULT_W;
  const h = heightFromStyle ?? node.measured?.height ?? PANEL_DEFAULT_H;
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
  childDimensions?: { width: number; height: number },
): boolean {
  const { width: parentW, height: parentH } = getPanelDimensions(parent);

  if (!childDimensions) {
    return childPos.x < 0 || childPos.y < 0 || childPos.x > parentW || childPos.y > parentH;
  }

  const overlapLeft = Math.max(0, childPos.x);
  const overlapTop = Math.max(0, childPos.y);
  const overlapRight = Math.min(childPos.x + childDimensions.width, parentW);
  const overlapBottom = Math.min(childPos.y + childDimensions.height, parentH);

  const overlapW = Math.max(0, overlapRight - overlapLeft);
  const overlapH = Math.max(0, overlapBottom - overlapTop);
  const overlapArea = overlapW * overlapH;
  const childArea = childDimensions.width * childDimensions.height;

  return childArea > 0 && overlapArea / childArea < 0.5;
}

export function findPanelContainingPoint(
  nodes: Node[],
  absX: number,
  absY: number,
  excludeParentId?: string | null,
  nodeLayouts?: Record<string, NodeLayout>,
  components?: Record<string, Component>,
): Node | undefined {
  const panels = nodes.filter(
    (n) => isReactFlowParentPanelType(String(n.type)) && n.id !== excludeParentId,
  );

  let bestPanel: Node | undefined;
  let bestArea = Infinity;

  for (const panel of panels) {
    let absolutePosition = panel.position;
    if (panel.parentId && nodeLayouts && components) {
      absolutePosition = resolveAbsolutePosition(panel.id, panel.position, components, nodeLayouts);
    }

    const { width, height } = getPanelDimensions(panel);
    const inside =
      absX > absolutePosition.x &&
      absY > absolutePosition.y &&
      absX < absolutePosition.x + width &&
      absY < absolutePosition.y + height;

    if (inside) {
      const area = width * height;
      if (area < bestArea) {
        bestArea = area;
        bestPanel = panel;
      }
    }
  }

  return bestPanel;
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

export function resolveAbsolutePosition(
  nodeId: string,
  relPos: { x: number; y: number },
  components: Record<string, Component>,
  nodeLayouts: Record<string, NodeLayout>,
): { x: number; y: number } {
  const component = components[nodeId];
  if (!component?.parentId) return relPos;
  const parentLayout = nodeLayouts[component.parentId];
  if (!parentLayout) return relPos;

  return resolveAbsolutePosition(
    component.parentId,
    { x: relPos.x + parentLayout.x, y: relPos.y + parentLayout.y },
    components,
    nodeLayouts,
  );
}

export function resolveAbsolutePositionFromNodes(
  nodeId: string,
  nodes: Node[],
): { x: number; y: number } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let absX = 0;
  let absY = 0;
  let currentId: string | undefined = nodeId;

  while (currentId) {
    const node = nodeMap.get(currentId);
    if (!node) break;
    absX += node.position.x;
    absY += node.position.y;
    currentId = node.parentId ?? undefined;
  }

  return { x: absX, y: absY };
}
