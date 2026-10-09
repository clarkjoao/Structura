/** An axis-aligned box in flow coordinates. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room left between an inserted fragment and what was already there. */
export const FREE_ORIGIN_GAP = 80;

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Where to put a fragment of `size` asked for at `origin`, so it covers none of
 * `occupied`: the origin itself when it is free, otherwise just right of
 * everything it would have covered, repeated until nothing is in the way. Only
 * the x moves, so the fragment stays at the height it was asked for.
 *
 * Not a layout: the fragment keeps its own shape and nothing else moves.
 *
 * @example
 * freeInsertOrigin({ x: 0, y: 0 }, { width: 600, height: 200 }, [{ x: 100, y: 50, width: 200, height: 80 }])
 * // → { x: 380, y: 0 }
 */
export function freeInsertOrigin(
  origin: { x: number; y: number },
  size: { width: number; height: number },
  occupied: readonly Box[],
): { x: number; y: number } {
  let x = origin.x;
  // Each pass moves past at least one box, so this ends within occupied.length passes.
  for (let pass = 0; pass <= occupied.length; pass += 1) {
    const at: Box = { x, y: origin.y, width: size.width, height: size.height };
    const hits = occupied.filter((box) => intersects(at, box));
    if (hits.length === 0) return { x, y: origin.y };
    x = Math.max(...hits.map((box) => box.x + box.width)) + FREE_ORIGIN_GAP;
  }
  return { x, y: origin.y };
}
