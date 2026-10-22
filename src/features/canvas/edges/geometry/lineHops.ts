import type { Point } from "@/features/diagram";

/**
 * Line hops: where two orthogonal edges cross, the horizontal one jumps over
 * the vertical one with a small arc, so a crossing reads as "passes over"
 * rather than "joins". Port of Mermaid 12's line jumps (`lineHops: true` in
 * its ELK config). Pure and unit-tested; `LineHopsContext` runs it over the
 * edges on screen.
 *
 * Only proper crossings hop: two edges that touch at an end, or run along the
 * same line, are not crossing each other.
 */

/** Arc radius at a crossing; Mermaid's value. */
export const LINE_HOP_RADIUS = 6;
/** Keep a hop this far from the ends of its segment... */
const END_CLEARANCE = 2;
/** ...and drop it when that leaves less than this share of the radius. */
const MIN_RADIUS_SHARE = 0.6;
const EPSILON = 1e-6;

/** A crossing on one of an edge's horizontal segments, where it hops. */
export interface LineHop {
  /** Index of the segment `points[segIndex] → points[segIndex + 1]`. */
  segIndex: number;
  x: number;
  y: number;
}

export interface HopPolyline {
  id: string;
  points: readonly Point[];
}

interface Vertical {
  id: string;
  x: number;
  minY: number;
  maxY: number;
}

function isHorizontal(a: Point, b: Point): boolean {
  return Math.abs(a.y - b.y) < EPSILON && Math.abs(a.x - b.x) >= EPSILON;
}

function isVertical(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) >= EPSILON;
}

/** First index in `sorted` whose x is greater than `x`. */
function upperBound(sorted: readonly Vertical[], x: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid]!.x <= x) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Every hop, per edge id. Edges with no hop are absent.
 *
 * Verticals are sorted by x once, so each horizontal segment only visits the
 * verticals within its own x span: O((H + V) log V + crossings) rather than
 * every pair of segments, which matters because this runs while nodes drag.
 *
 * @example
 * findLineHops([{ id: "a", points: [p(0, 50), p(100, 50)] }, { id: "b", points: [p(50, 0), p(50, 100)] }])
 * // Map { "a" => [{ segIndex: 0, x: 50, y: 50 }] }
 */
export function findLineHops(polylines: readonly HopPolyline[]): Map<string, LineHop[]> {
  const verticals: Vertical[] = [];
  for (const { id, points } of polylines) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i]!;
      const b = points[i + 1]!;
      if (isVertical(a, b)) {
        verticals.push({ id, x: a.x, minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) });
      }
    }
  }
  verticals.sort((a, b) => a.x - b.x);

  const hops = new Map<string, LineHop[]>();
  for (const { id, points } of polylines) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i]!;
      const b = points[i + 1]!;
      if (!isHorizontal(a, b)) continue;
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const y = a.y;

      const found: LineHop[] = [];
      for (let v = upperBound(verticals, minX + EPSILON); v < verticals.length; v += 1) {
        const vertical = verticals[v]!;
        if (vertical.x >= maxX - EPSILON) break;
        if (vertical.id === id) continue;
        // Strictly inside both segments: touching at an end is not a crossing.
        if (y <= vertical.minY + EPSILON || y >= vertical.maxY - EPSILON) continue;
        found.push({ segIndex: i, x: vertical.x, y });
      }
      if (found.length === 0) continue;

      // Along the direction of travel, so the path can emit them in order.
      found.sort((p, q) => (b.x >= a.x ? p.x - q.x : q.x - p.x));
      const list = hops.get(id);
      if (list) list.push(...found);
      else hops.set(id, found);
    }
  }
  return hops;
}

/** A jog shorter than this reads as a straight line, so it is drawn as one. */
const MICRO_JOG = 1;

type Axis = "h" | "v" | null;

function axisOf(a: Point, b: Point): Axis {
  if (isHorizontal(a, b)) return "h";
  if (isVertical(a, b)) return "v";
  return null;
}

/**
 * Drops points that repeat the one before, sit mid-way along a straight run,
 * or tip a sub-pixel spur (a run that steps out and straight back).
 */
function withoutRedundantPoints(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    for (;;) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - point.x) < EPSILON && Math.abs(last.y - point.y) < EPSILON) {
        break;
      }
      const before = out[out.length - 2];
      const axis = before && last ? axisOf(before, last) : null;
      if (axis === null || axis !== axisOf(last!, point)) {
        out.push({ x: point.x, y: point.y });
        break;
      }
      const key = axis === "h" ? "x" : "y";
      const into = last![key] - before![key];
      const onward = point[key] - last![key];
      const spur = Math.min(Math.abs(into), Math.abs(onward)) < MICRO_JOG;
      if (Math.sign(into) !== Math.sign(onward) && !spur) {
        out.push({ x: point.x, y: point.y });
        break;
      }
      out.pop();
    }
  }
  return out;
}

/**
 * The step polyline with every sub-pixel jog ironed out, or `points` itself
 * when there is none.
 *
 * A stored route rarely lands exactly on a handle measured later: a fraction
 * of a pixel off, the path makes a jog nobody can see. But the jog splits the
 * straight run in two, and a crossing that falls within a few pixels of the
 * split has no room for its arc, so the edge seems to pass straight through
 * the other one. The run on one side of the jog moves onto the other's line
 * instead — never a run that ends at a handle, so neither end moves.
 */
export function withoutMicroJogs(points: readonly Point[]): readonly Point[] {
  let out = withoutRedundantPoints(points);
  let changed = out.length !== points.length;

  for (let i = 1; i < out.length - 2; i += 1) {
    const jogAxis = axisOf(out[i]!, out[i + 1]!);
    const runAxis = axisOf(out[i - 1]!, out[i]!);
    if (jogAxis === null || runAxis === null || jogAxis === runAxis) continue;
    if (axisOf(out[i + 1]!, out[i + 2]!) !== runAxis) continue;
    const jog = jogAxis === "v" ? out[i + 1]!.y - out[i]!.y : out[i + 1]!.x - out[i]!.x;
    if (Math.abs(jog) >= MICRO_JOG) continue;

    const key = runAxis === "h" ? "y" : "x";
    // The run after the jog, up to the corner where it turns.
    let end = i + 1;
    while (end + 1 < out.length && axisOf(out[end]!, out[end + 1]!) === runAxis) end += 1;
    let start = i;
    while (start > 0 && axisOf(out[start - 1]!, out[start]!) === runAxis) start -= 1;

    if (end < out.length - 1) {
      for (let k = i + 1; k <= end; k += 1) out[k] = { ...out[k]!, [key]: out[i]![key] };
    } else if (start > 0) {
      for (let k = start; k <= i; k += 1) out[k] = { ...out[k]!, [key]: out[i + 1]![key] };
    } else {
      continue;
    }
    out = withoutRedundantPoints(out);
    changed = true;
    i = 0;
  }
  return changed ? out : points;
}

function format(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * The SVG path through `points` with an arc at each hop. Hops too close to a
 * corner shrink, and are dropped once they would be smaller than 60% of the
 * radius; two hops close together share the room between them.
 *
 * The arc always bulges upwards, whichever way the segment runs, so every
 * crossing on the canvas reads the same way.
 */
export function buildPathWithHops(
  points: readonly Point[],
  hops: readonly LineHop[],
  radius: number = LINE_HOP_RADIUS,
): string {
  if (points.length === 0) return "";
  const bySegment = new Map<number, LineHop[]>();
  for (const hop of hops) {
    const list = bySegment.get(hop.segIndex);
    if (list) list.push(hop);
    else bySegment.set(hop.segIndex, [hop]);
  }

  const first = points[0]!;
  let d = `M ${format(first.x)} ${format(first.y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const segmentHops = bySegment.get(i);
    if (segmentHops && isHorizontal(a, b)) {
      const direction = b.x >= a.x ? 1 : -1;
      const length = Math.abs(b.x - a.x);
      const placed = segmentHops
        // A hop computed for an older version of this path can name a point
        // off this segment for a frame; it is skipped, not drawn elsewhere.
        .filter((hop) => (hop.x - a.x) * direction > 0 && Math.abs(hop.y - a.y) < EPSILON)
        .map((hop) => {
          const along = Math.abs(hop.x - a.x);
          return {
            hop,
            along,
            r: Math.min(radius, along - END_CLEARANCE, length - along - END_CLEARANCE),
          };
        })
        .filter((entry) => entry.r >= radius * MIN_RADIUS_SHARE)
        .sort((p, q) => p.along - q.along);
      for (let k = 0; k < placed.length - 1; k += 1) {
        const gap = placed[k + 1]!.along - placed[k]!.along;
        if (placed[k]!.r + placed[k + 1]!.r > gap) {
          placed[k]!.r = Math.min(placed[k]!.r, gap / 2);
          placed[k + 1]!.r = Math.min(placed[k + 1]!.r, gap / 2);
        }
      }
      // Going right, a clockwise arc bulges up; going left, counter-clockwise does.
      const sweep = direction === 1 ? 1 : 0;
      for (const { hop, r } of placed) {
        if (r < radius * MIN_RADIUS_SHARE) continue;
        d += ` L ${format(hop.x - direction * r)} ${format(a.y)}`;
        d += ` A ${format(r)} ${format(r)} 0 0 ${sweep} ${format(hop.x + direction * r)} ${format(a.y)}`;
      }
    }
    d += ` L ${format(b.x)} ${format(b.y)}`;
  }
  return d;
}

/**
 * Just the hop arcs of a `buildPathWithHops` path, each as its own subpath.
 *
 * A dashed or dotted edge cuts its arcs into dashes like the rest of the line,
 * and a hop chopped into two or three pieces reads as a break, not as a jump.
 * The edge draws this solid on top so each arc stays whole.
 *
 * @example
 * hopArcsPath("M 0 50 L 44 50 A 6 6 0 0 1 56 50 L 100 50") // "M 44 50 A 6 6 0 0 1 56 50"
 */
export function hopArcsPath(path: string): string {
  const arcs: string[] = [];
  for (const match of path.matchAll(/L (\S+) (\S+) (A [^LAM]+)/g)) {
    arcs.push(`M ${match[1]} ${match[2]} ${match[3]!.trim()}`);
  }
  return arcs.join(" ");
}
