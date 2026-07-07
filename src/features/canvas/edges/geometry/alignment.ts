import type { Point } from "@/features/diagram";

/**
 * Magnetic alignment targets for edge editing: while dragging a corner, control
 * point, or segment, the moved coordinate can snap to a node's left/center/right
 * (x) or top/middle/bottom (y). Pure and unit-tested; the hooks capture node
 * boxes once at drag start and match against them on every move.
 */

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A candidate alignment line: a constant position plus the extent to draw it over. */
export interface AlignLine {
  pos: number;
  min: number;
  max: number;
}

export interface AlignmentTargets {
  /** Vertical lines (constant x), extents measured on y. */
  xs: AlignLine[];
  /** Horizontal lines (constant y), extents measured on x. */
  ys: AlignLine[];
}

/** Left/center/right and top/middle/bottom lines for every node box. */
export function buildAlignmentTargets(boxes: readonly NodeBox[]): AlignmentTargets {
  const xs: AlignLine[] = [];
  const ys: AlignLine[] = [];
  for (const b of boxes) {
    if (b.width <= 0 || b.height <= 0) continue;
    const top = b.y;
    const bottom = b.y + b.height;
    const left = b.x;
    const right = b.x + b.width;
    xs.push(
      { pos: left, min: top, max: bottom },
      { pos: b.x + b.width / 2, min: top, max: bottom },
      { pos: right, min: top, max: bottom },
    );
    ys.push(
      { pos: top, min: left, max: right },
      { pos: b.y + b.height / 2, min: left, max: right },
      { pos: bottom, min: left, max: right },
    );
  }
  return { xs, ys };
}

/** Nearest line whose position is within `threshold` of `value`, or `null`. */
export function findAlignment(
  value: number,
  lines: readonly AlignLine[],
  threshold: number,
): AlignLine | null {
  let best: AlignLine | null = null;
  let bestDist = threshold;
  for (const line of lines) {
    const dist = Math.abs(line.pos - value);
    if (dist <= bestDist) {
      bestDist = dist;
      best = line;
    }
  }
  return best;
}

/**
 * Build a guide line for a matched alignment, extended to also reach the dragged
 * handle so the user sees what it lines up with. `handlePerp` is the handle's
 * coordinate on the axis perpendicular to the line.
 */
export function alignmentExtent(line: AlignLine, handlePerp: number): { from: number; to: number } {
  return { from: Math.min(line.min, handlePerp), to: Math.max(line.max, handlePerp) };
}

/** Node boxes to align against, excluding an optional set (e.g. the edge's own endpoints). */
export function boxFromInternalNode(
  positionAbsolute: Point,
  measured: { width?: number; height?: number },
): NodeBox {
  return {
    x: positionAbsolute.x,
    y: positionAbsolute.y,
    width: measured.width ?? 0,
    height: measured.height ?? 0,
  };
}
