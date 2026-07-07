import { GRID_SIZE } from "../../canvas.constants";

/**
 * Map an arrow key to a nudge delta for edge handles. A plain arrow moves by one
 * grid cell (aligned to snapping); Shift moves by 1px for fine adjustment.
 * Returns `null` for non-arrow keys so the caller can ignore them.
 */
export function nudgeFromKey(key: string, fine: boolean): { x: number; y: number } | null {
  const step = fine ? 1 : GRID_SIZE;
  switch (key) {
    case "ArrowLeft":
      return { x: -step, y: 0 };
    case "ArrowRight":
      return { x: step, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -step };
    case "ArrowDown":
      return { x: 0, y: step };
    default:
      return null;
  }
}
