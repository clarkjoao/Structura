import type { ReactFlowInstance, Node } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import {
  isApiGroupComponent,
  isEndpointComponent,
  isPanelComponent,
  getCachedCanvasSnapshot,
} from "@/features/diagram";

export const PASTE_OFFSET = 20;

export type KeyHandler = (e: KeyboardEvent) => boolean | Promise<boolean>;

export type Platform = "mac" | "windows" | "linux";

export function getPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator as { platform?: string }).platform?.toLowerCase() ?? "";
  if (platform.includes("mac") || ua.includes("mac")) return "mac";
  if (platform.includes("win") || ua.includes("win")) return "windows";
  if (platform.includes("linux") || ua.includes("linux")) return "linux";
  return "windows";
}

export function isModKeyPressed(e: KeyboardEvent): boolean {
  const platform = getPlatform();
  return platform === "mac" ? e.metaKey : e.ctrlKey;
}

export function isInputFocused(target: EventTarget | null): boolean {
  const el = target as HTMLElement;
  if (!el) return false;
  // return (
  //   el.tagName === "INPUT" ||
  //   el.tagName === "TEXTAREA" ||
  //   el.tagName === "SELECT" ||
  //   !!el.isContentEditable
  // );

  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  // Monaco renderiza div[role="textbox"] como editor principal
  if (el.getAttribute?.("role") === "textbox") return true;
  // Subir até 5 níveis para capturar editores que delegam foco a filhos
  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    if (parent.isContentEditable) return true;
    const parentTag = parent.tagName;
    if (parentTag === "INPUT" || parentTag === "TEXTAREA") return true;
    if (parent.getAttribute?.("role") === "textbox") return true;
    parent = parent.parentElement;
    depth++;
  }
  return false;
}

export function getSelectedNodes(rf: ReactFlowInstance, fallbackId: string | null): Node[] {
  const nodes = rf.getNodes();
  const selected = nodes.filter((n) => n.selected);
  if (selected.length > 0) return selected;
  if (fallbackId) {
    const single = nodes.find((n) => n.id === fallbackId);
    return single ? [single] : [];
  }
  return [];
}

export function getCopyableIds(diagram: Diagram | DiagramModel, nodes: Node[]): string[] {
  const r = getCachedCanvasSnapshot(diagram);
  const selectedIds = nodes
    .map((n) => n.id)
    .filter((id) => {
      const component = r.components[id];
      if (!component) return false;
      if (isEndpointComponent(component)) return false;
      return true;
    });

  const expandedIds = new Set(selectedIds);

  const addChildrenRecursively = (parentId: string): void => {
    for (const component of Object.values(r.components)) {
      if (component.parentId !== parentId || expandedIds.has(component.id)) continue;
      expandedIds.add(component.id);
      addChildrenRecursively(component.id);
    }
  };

  for (const selectedId of selectedIds) {
    const component = r.components[selectedId];
    if (!component) continue;
    if (isPanelComponent(component) || isApiGroupComponent(component)) {
      addChildrenRecursively(selectedId);
    }
  }

  return [...expandedIds];
}

export function getOffsetPositionOfNodes(
  diagram: Diagram | DiagramModel,
  ids: string[],
): { x: number; y: number } | null {
  const r = getCachedCanvasSnapshot(diagram);
  const layouts = r.nodeLayouts;
  let minX = Infinity;
  let minY = Infinity;

  for (const id of ids) {
    const comp = r.components[id];
    if (!comp) continue;
    const layout = layouts[id];
    let x = layout?.x ?? 0;
    let y = layout?.y ?? 0;
    if (comp.parentId) {
      const parentLayout = layouts[comp.parentId];
      if (parentLayout) {
        x += parentLayout.x;
        y += parentLayout.y;
      }
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }

  if (!isFinite(minX) || !isFinite(minY)) return null;
  return { x: minX + PASTE_OFFSET, y: minY + PASTE_OFFSET };
}

export function getPasteCenter(
  rf: ReactFlowInstance,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
): { x: number; y: number } {
  const wrapper = wrapperRef.current;
  if (!wrapper) return { x: 300, y: 300 };
  const rect = wrapper.getBoundingClientRect();
  return rf.screenToFlowPosition({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
}

/** Flow position for paste: pointer if known, otherwise center of the canvas wrapper. */
export function getPasteFlowPosition(
  rf: ReactFlowInstance,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  lastPointerScreen: { x: number; y: number } | null,
): { x: number; y: number } {
  if (lastPointerScreen) {
    return rf.screenToFlowPosition(lastPointerScreen);
  }
  return getPasteCenter(rf, wrapperRef);
}

export function getCenterOfNodes(
  diagram: Diagram | DiagramModel,
  ids: string[],
  offset = 20,
): { x: number; y: number } {
  const r = getCachedCanvasSnapshot(diagram);
  const layouts = r.nodeLayouts;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const id of ids) {
    const comp = r.components[id];
    if (!comp) continue;

    const layout = layouts[id];
    let x = layout?.x ?? 0;
    let y = layout?.y ?? 0;

    if (comp.parentId) {
      const parentLayout = layouts[comp.parentId];
      if (parentLayout) {
        x += parentLayout.x;
        y += parentLayout.y;
      }
    }

    sumX += x;
    sumY += y;
    count += 1;
  }

  if (count === 0) return { x: 300, y: 300 };
  return { x: sumX / count + offset, y: sumY / count + offset };
}
