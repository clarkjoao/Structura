import { Position } from "@xyflow/react";
import type { Point } from "@/features/diagram";

/**
 * Orthogonal (draw.io-style) routing for editable-step edges. The path is made
 * of horizontal/vertical segments with sharp corners; the interior corners are
 * the edge's control points. A step edge with no stored corners renders a
 * default "Z" route whose segments are still axis-aligned and draggable. Pure
 * and unit-tested.
 */

/** Interior corners for the default orthogonal route between two endpoints. */
export function defaultOrthogonalCorners(
  source: Point,
  target: Point,
  sourcePosition: Position | undefined,
): Point[] {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const exitsHorizontally =
    sourcePosition === Position.Left ||
    sourcePosition === Position.Right ||
    sourcePosition === undefined;
  if (exitsHorizontally) {
    return [
      { x: midX, y: source.y },
      { x: midX, y: target.y },
    ];
  }
  return [
    { x: source.x, y: midY },
    { x: target.x, y: midY },
  ];
}

/** Orthogonal SVG path through the corners: horizontal then vertical per knot. */
export function buildStepPath(source: Point, target: Point, corners: readonly Point[]): string {
  const knots: Point[] = [source, ...corners, target];
  let path = `M ${knots[0].x} ${knots[0].y}`;
  for (let i = 1; i < knots.length; i += 1) {
    path += ` H ${knots[i].x} V ${knots[i].y}`;
  }
  return path;
}

export interface StepSegment {
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: "horizontal" | "vertical";
}

/** Straight segments between consecutive knots (source → corners → target). */
export function buildStepSegments(
  source: Point,
  target: Point,
  corners: readonly Point[],
): StepSegment[] {
  const pts: Point[] = [source, ...corners, target];
  return pts.slice(0, -1).map((point, index) => {
    const next = pts[index + 1];
    const isHorizontal = Math.abs(point.y - next.y) <= Math.abs(point.x - next.x);
    return {
      index,
      x1: point.x,
      y1: point.y,
      x2: next.x,
      y2: next.y,
      orientation: isHorizontal ? "horizontal" : "vertical",
    };
  });
}

/**
 * Reposition a segment by `delta`, keeping the route orthogonal, and return the
 * new interior corners. Horizontal segments move on Y, vertical on X. End
 * segments (touching source/target) spawn or shift the adjacent corner so the
 * fixed endpoint stays put.
 */
export function computeSegmentDrag(
  source: Point,
  target: Point,
  corners: readonly Point[],
  seg: StepSegment,
  delta: Point,
): Point[] {
  const pts: Point[] = [source, ...corners.map((c) => ({ x: c.x, y: c.y })), target];
  const i = seg.index;
  const j = i + 1;
  const interior = corners.map((c) => ({ x: c.x, y: c.y }));

  if (seg.orientation === "horizontal") {
    const dy = delta.y;
    if (interior.length === 0) {
      const newY = source.y + dy;
      return [
        { x: source.x, y: newY },
        { x: target.x, y: newY },
      ];
    }
    if (i === 0) {
      const newY = pts[0].y + dy;
      return [{ x: source.x, y: newY }, { x: pts[1].x, y: newY }, ...interior.slice(1)];
    }
    if (j === pts.length - 1) {
      const lastKnot = interior.length;
      const newY = pts[lastKnot].y + dy;
      return [
        ...interior.slice(0, interior.length - 1),
        { x: pts[lastKnot].x, y: newY },
        { x: target.x, y: newY },
      ];
    }
    const next = interior.slice();
    if (i > 0) next[i - 1] = { ...next[i - 1], y: pts[i].y + dy };
    if (j < pts.length - 1) next[j - 1] = { ...next[j - 1], y: pts[j].y + dy };
    return next;
  }

  const dx = delta.x;
  if (interior.length === 0) {
    const newX = source.x + dx;
    return [
      { x: newX, y: source.y },
      { x: newX, y: target.y },
    ];
  }
  if (i === 0) {
    const newX = pts[0].x + dx;
    return [{ x: newX, y: source.y }, { x: newX, y: pts[1].y }, ...interior.slice(1)];
  }
  if (j === pts.length - 1) {
    const lastKnot = interior.length;
    const newX = pts[lastKnot].x + dx;
    return [
      ...interior.slice(0, interior.length - 1),
      { x: newX, y: pts[lastKnot].y },
      { x: newX, y: target.y },
    ];
  }
  const next = interior.slice();
  if (i > 0) next[i - 1] = { ...next[i - 1], x: pts[i].x + dx };
  if (j < pts.length - 1) next[j - 1] = { ...next[j - 1], x: pts[j].x + dx };
  return next;
}

/** Shortest orthogonal segment allowed during a drag (flow units). */
export const MIN_SEGMENT_LENGTH = 10;

/**
 * Push `value` so it stays at least `min` away from `boundary`, keeping it on
 * the same side. Used to stop an orthogonal segment collapsing to (or inverting
 * through) zero length against a fixed endpoint during a drag.
 */
export function clampSegmentLength(value: number, boundary: number, min: number): number {
  if (Math.abs(value - boundary) >= min) return value;
  return value >= boundary ? boundary + min : boundary - min;
}

/**
 * Reposition a single interior corner by `delta`, keeping the route orthogonal,
 * and return the new interior corners. The corner joins one horizontal and one
 * vertical segment; moving it drags the shared coordinate of each adjacent
 * interior corner so both segments stay axis-aligned. When a neighbour is a
 * fixed endpoint (source/target) the corner is constrained on that axis so the
 * endpoint segment cannot become diagonal, and it is clamped to keep the
 * endpoint segment at least `min` long.
 */
export function computeCornerDrag(
  source: Point,
  target: Point,
  corners: readonly Point[],
  cornerIndex: number,
  delta: Point,
  min: number = MIN_SEGMENT_LENGTH,
): Point[] {
  const next = corners.map((c) => ({ x: c.x, y: c.y }));
  if (cornerIndex < 0 || cornerIndex >= next.length) return next;

  const knots: Point[] = [source, ...corners, target];
  const m = cornerIndex + 1;
  const a = knots[m - 1];
  const c = knots[m];
  const aIsFixed = m - 1 === 0;
  const bIsFixed = m + 1 === knots.length - 1;
  // In a valid orthogonal route the corner shares exactly one axis with each
  // neighbour; classify the incoming (a→c) segment the same way as segments do.
  const acHorizontal = Math.abs(a.y - c.y) <= Math.abs(a.x - c.x);

  if (acHorizontal) {
    // a→c horizontal (shares y), c→b vertical (shares x).
    const dy = aIsFixed ? 0 : delta.y;
    const dx = bIsFixed ? 0 : delta.x;
    let newX = c.x + dx;
    let newY = c.y + dy;
    // c→b vertical touches the target when b is fixed: keep it long enough.
    if (bIsFixed) newY = clampSegmentLength(newY, target.y, min);
    // a→c horizontal touches the source when a is fixed: keep it long enough.
    if (aIsFixed) newX = clampSegmentLength(newX, source.x, min);
    next[cornerIndex] = { x: newX, y: newY };
    if (!aIsFixed) next[cornerIndex - 1] = { ...next[cornerIndex - 1], y: newY };
    if (!bIsFixed) next[cornerIndex + 1] = { ...next[cornerIndex + 1], x: newX };
    return next;
  }

  // a→c vertical (shares x), c→b horizontal (shares y).
  const dx = aIsFixed ? 0 : delta.x;
  const dy = bIsFixed ? 0 : delta.y;
  let newX = c.x + dx;
  let newY = c.y + dy;
  if (bIsFixed) newX = clampSegmentLength(newX, target.x, min);
  if (aIsFixed) newY = clampSegmentLength(newY, source.y, min);
  next[cornerIndex] = { x: newX, y: newY };
  if (!aIsFixed) next[cornerIndex - 1] = { ...next[cornerIndex - 1], x: newX };
  if (!bIsFixed) next[cornerIndex + 1] = { ...next[cornerIndex + 1], y: newY };
  return next;
}

const EPSILON = 0.01;

/**
 * Drop interior corners that no longer bend the route: a corner collinear with
 * both neighbours (same x or same y across all three knots) or coincident with a
 * neighbour. Runs at the end of a drag so reshaping cannot leave phantom bends
 * in the persisted layout. Pure and order-preserving.
 */
export function pruneRedundantCorners(
  source: Point,
  target: Point,
  corners: readonly Point[],
): Point[] {
  const knots: Point[] = [source, ...corners.map((c) => ({ x: c.x, y: c.y })), target];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < knots.length - 1; i += 1) {
      const a = knots[i - 1];
      const b = knots[i];
      const c = knots[i + 1];
      const collinearH = Math.abs(a.y - b.y) < EPSILON && Math.abs(b.y - c.y) < EPSILON;
      const collinearV = Math.abs(a.x - b.x) < EPSILON && Math.abs(b.x - c.x) < EPSILON;
      const coincident =
        (Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON) ||
        (Math.abs(b.x - c.x) < EPSILON && Math.abs(b.y - c.y) < EPSILON);
      if (collinearH || collinearV || coincident) {
        knots.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return knots.slice(1, -1);
}

/**
 * Snap a point to the nearest grid intersection, but only on an axis where the
 * nearest grid line is within `threshold`. Leaves the coordinate untouched
 * otherwise, so the snap feels magnetic rather than sticky.
 */
export function snapToGrid(point: Point, gridSize: number, threshold: number): Point {
  const snapAxis = (value: number): number => {
    const nearest = Math.round(value / gridSize) * gridSize;
    return Math.abs(nearest - value) <= threshold ? nearest : value;
  };
  return { x: snapAxis(point.x), y: snapAxis(point.y) };
}
