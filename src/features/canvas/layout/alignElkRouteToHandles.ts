import { Position } from "@xyflow/react";
import type { Point } from "@/features/diagram";
import { defaultOrthogonalCorners } from "../edges/geometry/orthogonal";

const EPSILON = 0.5;
/** Clear the node side before turning — keeps marker-end on a horizontal leg. */
const PORT_STUB = 20;

/**
 * Turn an ELK border→border route into EditableStep control-point corners that
 * start/end on Structura's fixed L/R handle anchors.
 *
 * ELK attaches anywhere on the node side; the canvas draws from discrete handle
 * slots. Raw `route.slice(1,-1)` leaves jogs and — worse — a vertical last leg
 * into the target, so SVG `marker-end` triangles point up instead of into the
 * handle.
 *
 * This keeps ELK's interior corridor, pins short horizontal stubs on the real
 * handle Ys (exit right / enter left), forces H-then-V orthography to match
 * `buildStepPath`, and returns the interior knots as control points.
 */
export function alignElkRouteToHandles(
  route: readonly Point[] | undefined,
  source: Point,
  target: Point,
): Point[] {
  if (route === undefined || route.length < 2) {
    return defaultOrthogonalCorners(source, target, Position.Right);
  }

  const interior = route.slice(1, -1);
  const exit = { x: source.x + PORT_STUB, y: source.y };
  const entry = { x: target.x - PORT_STUB, y: target.y };
  const seed: Point[] = [source, exit, ...interior, entry, target];
  const orthogonal = forceOrthogonalHFirst(seed);
  const simplified = collapseCollinear(orthogonal);

  if (simplified.length <= 2) {
    return defaultOrthogonalCorners(source, target, Position.Right);
  }

  return simplified.slice(1, -1).map((point) => ({ x: point.x, y: point.y }));
}

/** Insert H-then-V bends wherever a leg would be diagonal — same as `buildStepPath`. */
function forceOrthogonalHFirst(points: readonly Point[]): Point[] {
  if (points.length === 0) return [];
  const out: Point[] = [{ x: points[0]!.x, y: points[0]!.y }];

  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1]!;
    const next = points[i]!;
    if (!near(prev.x, next.x) && !near(prev.y, next.y)) {
      out.push({ x: next.x, y: prev.y });
    }
    out.push({ x: next.x, y: next.y });
  }

  return out;
}

/** Drop consecutive duplicates and middle points of a straight H/V run. */
function collapseCollinear(points: readonly Point[]): Point[] {
  if (points.length <= 2) return points.map((point) => ({ x: point.x, y: point.y }));

  const deduped: Point[] = [{ x: points[0]!.x, y: points[0]!.y }];
  for (let i = 1; i < points.length; i += 1) {
    const prev = deduped[deduped.length - 1]!;
    const point = points[i]!;
    if (near(prev.x, point.x) && near(prev.y, point.y)) continue;
    deduped.push({ x: point.x, y: point.y });
  }

  if (deduped.length <= 2) return deduped;

  const out: Point[] = [deduped[0]!];
  for (let i = 1; i < deduped.length - 1; i += 1) {
    const prev = out[out.length - 1]!;
    const mid = deduped[i]!;
    const next = deduped[i + 1]!;
    const colinearH = near(prev.y, mid.y) && near(mid.y, next.y);
    const colinearV = near(prev.x, mid.x) && near(mid.x, next.x);
    if (colinearH || colinearV) continue;
    out.push(mid);
  }
  out.push(deduped[deduped.length - 1]!);
  return out;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}
