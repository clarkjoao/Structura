import type { ReactFlowInstance } from "@xyflow/react";

export function getViewportCenter(
  rfInstance: ReactFlowInstance,
  isPanelOpen = false,
): { x: number; y: number } {
  const { x, y, zoom } = rfInstance.getViewport();
  const availableWidth = window.innerWidth - (isPanelOpen ? 320 : 0);
  return {
    x: (-x + availableWidth / 2) / zoom,
    y: (-y + window.innerHeight / 2) / zoom,
  };
}
