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
