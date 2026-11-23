import type { KindOverlay } from "./kind.types";

/** The label row's depth inside the band. */
export const OVERLAY_LABEL_DEPTH = 28;

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The band's extent along the axis: its segments. Null when it has none. */
function bandAlong(overlay: KindOverlay): { min: number; max: number } | null {
  const along = overlay.segments.flatMap((s) => [s.from, s.to]);
  if (along.length === 0) return null;
  return { min: Math.min(...along), max: Math.max(...along) };
}

/** A rectangle given along/across extents, in flow coordinates. */
export function overlayRect(
  overlay: Pick<KindOverlay, "axis">,
  along: number,
  alongSize: number,
  across: number,
  acrossSize: number,
): OverlayRect {
  return overlay.axis === "x"
    ? { x: along, y: across, width: alongSize, height: acrossSize }
    : { x: across, y: along, width: acrossSize, height: alongSize };
}

/**
 * Everything the overlay draws, in flow coordinates (spec guided-overlay-fit-export):
 * the band and the separators. Null when it draws nothing.
 */
export function overlayBounds(overlay: KindOverlay): OverlayRect | null {
  const rects: OverlayRect[] = [];
  const band = bandAlong(overlay);
  if (band)
    rects.push(overlayRect(overlay, band.min, band.max - band.min, overlay.at, overlay.depth));
  for (const s of overlay.separators)
    rects.push(overlayRect(overlay, s.along, 0, s.from, s.to - s.from));
  for (const l of overlay.lines ?? [])
    rects.push(overlayRect(overlay, l.from, l.to - l.from, l.across, 0));
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** The union of two rectangles; either may be null. */
export function unionRect(a: OverlayRect | null, b: OverlayRect | null): OverlayRect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}
