import type { Point } from "@/features/diagram";
import { getPathKnots } from "./paths";

/**
 * Polyline projection helpers over an editable edge's knots (source → points →
 * target). Label placement and ghost-midpoint positioning use the straight
 * polyline through the knots — a good, cheap approximation of the rendered
 * curve. Pure and unit-tested.
 */

function segmentLengths(knots: readonly Point[]): { lengths: number[]; total: number } {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < knots.length - 1; i += 1) {
    const len = Math.hypot(knots[i + 1].x - knots[i].x, knots[i + 1].y - knots[i].y);
    lengths.push(len);
    total += len;
  }
  return { lengths, total };
}

export function clampOffset(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/** Point at a normalized offset (0..1) along the polyline through the knots. */
export function getPointAtOffset(
  source: Point,
  target: Point,
  points: readonly Point[],
  offset: number,
): Point {
  const knots = getPathKnots(source, target, points);
  const { lengths, total } = segmentLengths(knots);
  if (total === 0) return { x: knots[0].x, y: knots[0].y };

  const targetLength = total * clampOffset(offset);
  let accumulated = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const len = lengths[i];
    if (accumulated + len >= targetLength) {
      const t = len === 0 ? 0 : (targetLength - accumulated) / len;
      return {
        x: knots[i].x + (knots[i + 1].x - knots[i].x) * t,
        y: knots[i].y + (knots[i + 1].y - knots[i].y) * t,
      };
    }
    accumulated += len;
  }
  const last = knots[knots.length - 1];
  return { x: last.x, y: last.y };
}

/** Normalized offset (0..1) of the polyline point closest to `pos`. */
export function getClosestOffsetOnPath(
  source: Point,
  target: Point,
  points: readonly Point[],
  pos: Point,
): number {
  const knots = getPathKnots(source, target, points);
  const { lengths, total } = segmentLengths(knots);
  if (total === 0) return 0.5;

  let bestOffset = 0.5;
  let bestDist = Number.POSITIVE_INFINITY;
  let accumulated = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const len = lengths[i];
    if (len === 0) {
      continue;
    }
    const dx = knots[i + 1].x - knots[i].x;
    const dy = knots[i + 1].y - knots[i].y;
    const dot = (pos.x - knots[i].x) * dx + (pos.y - knots[i].y) * dy;
    const t = Math.max(0, Math.min(1, dot / (len * len)));
    const projX = knots[i].x + t * dx;
    const projY = knots[i].y + t * dy;
    const dist = Math.hypot(pos.x - projX, pos.y - projY);
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = (accumulated + t * len) / total;
    }
    accumulated += len;
  }
  return bestOffset;
}

export interface GhostMidpoint {
  /** Index at which to splice a new control point into the `points` array. */
  insertIndex: number;
  x: number;
  y: number;
}

/**
 * Midpoints of each polyline segment, used as "click to add a control point"
 * affordances. The midpoint between knot j and j+1 inserts a new control point
 * at index j in the `points` array.
 */
export function getGhostMidpoints(
  source: Point,
  target: Point,
  points: readonly Point[],
): GhostMidpoint[] {
  const knots = getPathKnots(source, target, points);
  const ghosts: GhostMidpoint[] = [];
  for (let j = 0; j < knots.length - 1; j += 1) {
    ghosts.push({
      insertIndex: j,
      x: (knots[j].x + knots[j + 1].x) / 2,
      y: (knots[j].y + knots[j + 1].y) / 2,
    });
  }
  return ghosts;
}
