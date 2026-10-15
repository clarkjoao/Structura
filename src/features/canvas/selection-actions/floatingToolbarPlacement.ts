export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export type ToolbarSide = "top" | "bottom" | "inside";

export interface ToolbarPlacement {
  x: number;
  y: number;
  side: ToolbarSide;
}

interface PlaceOptions {
  /** The selection's box, in screen pixels relative to the canvas. */
  target: ScreenRect;
  toolbar: ScreenSize;
  viewport: ScreenSize;
  /** Distance between the selection and the toolbar. */
  gap?: number;
  /** Closest the toolbar may come to the canvas edge. */
  margin?: number;
}

const DEFAULT_GAP = 10;
const DEFAULT_MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Where a selection's toolbar goes so it is always on screen and close to what
 * it acts on.
 *
 * Above the selection when there is room; below when the top has no room but the
 * selection's top edge is on screen; otherwise pinned inside, at the top of the
 * part of the selection that is visible. That last case is a group bigger than
 * the screen, or zoomed in past it: the toolbar rides along with the visible
 * part instead of hanging off-screen at an edge the user cannot see.
 */
export function placeFloatingToolbar({
  target,
  toolbar,
  viewport,
  gap = DEFAULT_GAP,
  margin = DEFAULT_MARGIN,
}: PlaceOptions): ToolbarPlacement {
  const left = Math.max(target.x, 0);
  const right = Math.min(target.x + target.width, viewport.width);
  const top = Math.max(target.y, 0);
  const bottom = Math.min(target.y + target.height, viewport.height);
  const visible = right >= left && bottom >= top;

  // Centred on what is visible; a selection wholly off-screen falls back to its
  // own centre and the clamp below brings the toolbar to the nearest edge.
  const centreX = visible ? (left + right) / 2 : target.x + target.width / 2;
  const x = clamp(centreX - toolbar.width / 2, margin, viewport.width - toolbar.width - margin);

  const above = target.y - gap - toolbar.height;
  if (above >= margin && above + toolbar.height <= viewport.height - margin) {
    return { x, y: above, side: "top" };
  }

  const targetBottom = target.y + target.height;
  const below = targetBottom + gap + toolbar.height;
  if (target.y >= 0 && below <= viewport.height - margin) {
    return { x, y: targetBottom + gap, side: "bottom" };
  }

  const pinned = (visible ? top : target.y) + gap;
  return {
    x,
    y: clamp(pinned, margin, viewport.height - toolbar.height - margin),
    side: "inside",
  };
}
