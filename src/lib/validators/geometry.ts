/**
 * Geometry predicates shared by the validators.
 * Pure functions on rectangles and segments — no engine or React Flow types.
 */

import type { Rect } from "../layout-engine/edge-ports";

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  a: Point;
  b: Point;
}

export function rectCentre(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Overlapping area of two rectangles; 0 when they merely touch. */
export function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return overlapArea(a, b) > 0;
}

/** True when `inner` lies entirely within `outer`. */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function orientation(p: Point, q: Point, r: Point): number {
  const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  );
}

/** Standard orientation-based segment intersection, including collinear touching. */
export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const o1 = orientation(s1.a, s1.b, s2.a);
  const o2 = orientation(s1.a, s1.b, s2.b);
  const o3 = orientation(s2.a, s2.b, s1.a);
  const o4 = orientation(s2.a, s2.b, s1.b);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(s1.a, s2.a, s1.b)) return true;
  if (o2 === 0 && onSegment(s1.a, s2.b, s1.b)) return true;
  if (o3 === 0 && onSegment(s2.a, s1.a, s2.b)) return true;
  if (o4 === 0 && onSegment(s2.a, s1.b, s2.b)) return true;

  return false;
}

/** Whether a segment crosses a rectangle's interior (endpoints inside count). */
export function segmentIntersectsRect(segment: Segment, rect: Rect): boolean {
  const inside = (p: Point) =>
    p.x > rect.x && p.x < rect.x + rect.width && p.y > rect.y && p.y < rect.y + rect.height;

  if (inside(segment.a) || inside(segment.b)) return true;

  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  for (let i = 0; i < 4; i += 1) {
    const edge: Segment = { a: corners[i]!, b: corners[(i + 1) % 4]! };
    if (segmentsIntersect(segment, edge)) return true;
  }

  return false;
}

export function segmentLength(segment: Segment): number {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
}

/** Shortest distance from a point to a segment. */
export function pointToSegmentDistance(point: Point, segment: Segment): number {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return Math.hypot(point.x - segment.a.x, point.y - segment.a.y);

  let t = ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return Math.hypot(point.x - (segment.a.x + t * dx), point.y - (segment.a.y + t * dy));
}

/** Shortest distance between a rectangle and a point; 0 when the point is inside. */
export function rectToPointDistance(rect: Rect, point: Point): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

/** Two segments overlapping collinearly for at least `minLength`. */
export function collinearOverlap(s1: Segment, s2: Segment, minLength: number): boolean {
  const isVertical = (s: Segment) => Math.abs(s.a.x - s.b.x) < 1e-6;
  const isHorizontal = (s: Segment) => Math.abs(s.a.y - s.b.y) < 1e-6;

  if (isVertical(s1) && isVertical(s2) && Math.abs(s1.a.x - s2.a.x) < 1e-6) {
    const overlap =
      Math.min(Math.max(s1.a.y, s1.b.y), Math.max(s2.a.y, s2.b.y)) -
      Math.max(Math.min(s1.a.y, s1.b.y), Math.min(s2.a.y, s2.b.y));
    return overlap >= minLength;
  }

  if (isHorizontal(s1) && isHorizontal(s2) && Math.abs(s1.a.y - s2.a.y) < 1e-6) {
    const overlap =
      Math.min(Math.max(s1.a.x, s1.b.x), Math.max(s2.a.x, s2.b.x)) -
      Math.max(Math.min(s1.a.x, s1.b.x), Math.min(s2.a.x, s2.b.x));
    return overlap >= minLength;
  }

  return false;
}
