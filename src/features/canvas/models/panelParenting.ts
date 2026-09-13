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
  return isOutsideParentSize(childPos, getPanelDimensions(parent), childDimensions);
}

/** Same rule as `isOutsideParentBounds`, given the parent's size instead of its node. */
export function isOutsideParentSize(
  childPos: { x: number; y: number },
  parentSize: { width: number; height: number },
  childDimensions?: { width: number; height: number },
): boolean {
  const { width: parentW, height: parentH } = parentSize;

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

/**
 * A drop-target index built once per drag gesture.
 *
 * `findPanelContainingPoint` walks every node and re-resolves every panel's
 * absolute position on each call, which put an O(N) pass on every frame of a
 * drag — O(S * N) with a multi-selection. Panels do not move while one of their
 * children is dragged, and a dragged panel is excluded along with its
 * descendants, so the answer is stable for the whole gesture: build it once.
 *
 * Absolute positions come from `resolveAbsolutePosition` over
 * `(components, nodeLayouts)` — the single coordinate authority. The per-frame
 * path used to mix that with a second authority that summed React Flow node
 * positions, which disagree with the store for as long as a gesture is in
 * flight.
 */
export interface PanelIndexEntry {
  id: string;
  absolutePosition: { x: number; y: number };
  width: number;
  height: number;
  area: number;
}

export interface GesturePanelIndex {
  /** Drop targets, smallest area first — the first hit is the innermost panel. */
  panels: PanelIndexEntry[];
  /** Absolute position of every panel, for relative <-> absolute conversion. */
  absoluteById: Map<string, { x: number; y: number }>;
  /** Size of every panel, so a bounds check needs no node lookup. */
  sizeById: Map<string, { width: number; height: number }>;
}

export function buildGesturePanelIndex(
  nodes: Node[],
  components: Record<string, Component>,
  nodeLayouts: Record<string, NodeLayout>,
  excludedIds?: ReadonlySet<string>,
): GesturePanelIndex {
  const panels: PanelIndexEntry[] = [];
  const absoluteById = new Map<string, { x: number; y: number }>();
  const sizeById = new Map<string, { width: number; height: number }>();

  for (const node of nodes) {
    if (!isReactFlowParentPanelType(String(node.type))) continue;
    const absolutePosition = node.parentId
      ? resolveAbsolutePosition(node.id, node.position, components, nodeLayouts)
      : node.position;
    const { width, height } = getPanelDimensions(node);
    // Every panel is resolvable; only the drop-target list honours the exclusion,
    // so a dragged panel still converts its own children between coordinate spaces.
    absoluteById.set(node.id, absolutePosition);
    sizeById.set(node.id, { width, height });
    if (excludedIds?.has(node.id)) continue;
    panels.push({ id: node.id, absolutePosition, width, height, area: width * height });
  }

  panels.sort((a, b) => a.area - b.area);
  return { panels, absoluteById, sizeById };
}

/** The innermost panel containing the point, or undefined. O(panels), not O(nodes). */
export function findPanelInIndex(
  index: GesturePanelIndex,
  absX: number,
  absY: number,
  excludeParentId?: string | null,
): PanelIndexEntry | undefined {
  for (const panel of index.panels) {
    if (panel.id === excludeParentId) continue;
    const { x, y } = panel.absolutePosition;
    if (absX > x && absY > y && absX < x + panel.width && absY < y + panel.height) {
      return panel;
    }
  }
  return undefined;
}

/** Absolute position of a node given its parent and its parent-relative position. */
export function resolveAbsoluteFromIndex(
  index: GesturePanelIndex,
  parentId: string | null | undefined,
  relativePosition: { x: number; y: number },
): { x: number; y: number } {
  if (!parentId) return relativePosition;
  const parentAbsolute = index.absoluteById.get(parentId);
  if (!parentAbsolute) return relativePosition;
  return { x: parentAbsolute.x + relativePosition.x, y: parentAbsolute.y + relativePosition.y };
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

export function buildNodeMap(nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * Same walk as `resolveAbsolutePositionFromNodes` but over a map the caller already
 * has. Commit time resolves one node per selected node; rebuilding the map inside
 * each call made that O(S * N).
 */
export function resolveAbsolutePositionFromNodeMap(
  nodeId: string,
  nodeMap: Map<string, Node>,
): { x: number; y: number } {
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

export function resolveAbsolutePositionFromNodes(
  nodeId: string,
  nodes: Node[],
): { x: number; y: number } {
  const nodeMap = buildNodeMap(nodes);
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
