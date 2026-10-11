/** A node's measured size, as React Flow reports it once the node is drawn. */
type Measured = { width?: number; height?: number } | undefined;

/**
 * The sizes of the elements to frame, as one comparable value — or null while any of them on
 * the canvas is still unmeasured, or none is there yet. Framing waits until this is non-null
 * and the same on two reads in a row: React Flow leaves unmeasured nodes out of `fitView`, and
 * an edited element keeps its old size until it is measured again.
 */
export function framingSignature(
  ids: readonly string[],
  measuredOf: (id: string) => Measured | null,
): string | null {
  const sizes: string[] = [];
  for (const id of ids) {
    const measured = measuredOf(id);
    if (measured === null) continue; // not on the canvas
    if (measured?.width === undefined || measured.height === undefined) return null;
    sizes.push(`${id}:${measured.width}x${measured.height}`);
  }
  return sizes.length > 0 ? sizes.join("|") : null;
}

/** A rectangle in flow coordinates. */
export interface FlowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Whether every rectangle is wholly on screen, for a viewport `[x, y, zoom]` over a canvas of
 * `width` × `height` pixels. Nothing to show counts as shown.
 */
export function allInView(
  rects: readonly FlowRect[],
  [x, y, zoom]: readonly [number, number, number],
  width: number,
  height: number,
): boolean {
  const left = -x / zoom;
  const top = -y / zoom;
  const right = left + width / zoom;
  const bottom = top + height / zoom;
  return rects.every(
    (r) => r.x >= left && r.y >= top && r.x + r.width <= right && r.y + r.height <= bottom,
  );
}
