/**
 * Geometry for showing and following peers' cursors. Cursors travel in flow coordinates — the
 * diagram's own space — so they land on the same element whatever each person's pan, zoom or
 * window size; every viewer maps them through its own viewport.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Where a flow point is drawn inside the pane, in pixels from its top-left corner. */
export function flowToPane(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

/**
 * Whether a pane point has left the central part of the pane that following keeps the peer's
 * cursor in. Recentering only then — not on every move — keeps the follower's view still while the
 * peer works on one area, instead of sliding under them with each twitch of the mouse.
 */
export function outsideFollowZone(point: Point, pane: Size, marginRatio = 0.2): boolean {
  const marginX = pane.width * marginRatio;
  const marginY = pane.height * marginRatio;
  return (
    point.x < marginX ||
    point.x > pane.width - marginX ||
    point.y < marginY ||
    point.y > pane.height - marginY
  );
}
