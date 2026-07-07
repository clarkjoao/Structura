import type { EdgePathType, Point } from "@/features/diagram";

/**
 * Pure SVG-path geometry for editable edges. These helpers take flow-space
 * coordinates and know nothing about React or the store — they are unit-tested
 * in isolation and reused by the edge component and the label/ghost logic.
 */

/** The full ordered knot list an editable path passes through: source → points → target. */
export function getPathKnots(source: Point, target: Point, points: readonly Point[]): Point[] {
  return [source, ...points.map((p) => ({ x: p.x, y: p.y })), target];
}

function toLinearPath(knots: readonly Point[]): string {
  if (knots.length === 0) return "";
  let d = `M ${knots[0].x} ${knots[0].y}`;
  for (let i = 1; i < knots.length; i += 1) {
    d += ` L ${knots[i].x} ${knots[i].y}`;
  }
  return d;
}

/**
 * Uniform Catmull-Rom spline through the knots, emitted as cubic béziers.
 * With only two knots this degenerates to a straight line, matching a
 * point-less editable edge.
 */
function toCatmullRomPath(knots: readonly Point[]): string {
  if (knots.length < 2) return knots.length === 1 ? `M ${knots[0].x} ${knots[0].y}` : "";
  if (knots.length === 2) return toLinearPath(knots);

  let d = `M ${knots[0].x} ${knots[0].y}`;
  for (let i = 0; i < knots.length - 1; i += 1) {
    const p0 = knots[i - 1] ?? knots[i];
    const p1 = knots[i];
    const p2 = knots[i + 1];
    const p3 = knots[i + 2] ?? knots[i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Build the SVG path string for an editable edge with the given control points. */
export function buildEditableEdgePath(
  source: Point,
  target: Point,
  points: readonly Point[],
  pathType: EdgePathType = "catmull-rom",
): string {
  const knots = getPathKnots(source, target, points);
  return pathType === "linear" ? toLinearPath(knots) : toCatmullRomPath(knots);
}
