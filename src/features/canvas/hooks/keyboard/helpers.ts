import type { ReactFlowInstance, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { resolveCanvasSnapshot } from "@/features/diagram";

export type KeyHandler = (e: KeyboardEvent) => boolean;

type Platform = "mac" | "windows" | "linux";

function getPlatform(): Platform {
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
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    !!el.isContentEditable
  );
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

export function getCopyableIds(diagram: Diagram, nodes: Node[]): string[] {
  const r = resolveCanvasSnapshot(diagram);
  return nodes
    .map((n) => n.id)
    .filter((id) => {
      const c = r.components[id];
      return c && c.type !== "panel" && c.type !== "note";
    });
}

export function getPasteCenter(
  rf: ReactFlowInstance,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
): { x: number; y: number } {
  const wrapper = wrapperRef.current;
  if (!wrapper) return { x: 300, y: 300 };
  const rect = wrapper.getBoundingClientRect();
  return rf.screenToFlowPosition({
    x: rect.width / 2,
    y: rect.height / 2,
  });
}

export function getCenterOfNodes(
  diagram: Diagram,
  ids: string[],
  offset = 20,
): { x: number; y: number } {
  const r = resolveCanvasSnapshot(diagram);
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
