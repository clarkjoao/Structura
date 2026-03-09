import type { ReactFlowInstance } from "@xyflow/react";

/**
 * Returns the canvas coordinate that maps to the center of the visible
 * viewport area. Pass `isPanelOpen = true` to exclude the 320px side
 * panel from the width calculation.
 */
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