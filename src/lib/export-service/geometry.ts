import { CONFIG } from "./constants";
import type { GeometryInfo } from "./types";

export function calculateGeometry(
  layout: { x: number; y: number; width?: number; height?: number } | null | undefined,
  parentLayout:
    | { x: number; y: number; width?: number; height?: number }
    | undefined,
  isPanel: boolean,
): GeometryInfo {
  if (!layout) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const x = parentLayout ? layout.x - parentLayout.x : layout.x;
  const y = parentLayout
    ? layout.y - parentLayout.y - (isPanel ? 0 : CONFIG.swimlaneHeader)
    : layout.y;

  return {
    x,
    y,
    width: layout.width ?? 0,
    height: layout.height ?? 0,
  };
}
