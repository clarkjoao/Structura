import type { Point } from "@/features/diagram";
import { segmentCrossesBox, segmentsIntersect } from "./layoutReadability";

/**
 * Removes the small jog an auto-laid-out edge makes right after it leaves its
 * source, or right before it reaches its target. Port of Mermaid 12's
 * `straightenEdges` post-pass over its ELK routes.
 *
 * The jog comes from snapping: ELK attaches an edge anywhere on a node side,
 * the canvas draws it from a discrete handle slot, and `alignElkRouteToHandles`
 * bridges the two with a short step. When that step is small the eye reads it
 * as noise, not as routing, so the run after it is moved onto the handle's
 * line and the step disappears.
 *
 * A route is only straightened when that does not add a crossing with any
 * other route — the same guard Mermaid uses — so this can only ever trade a
 * jog for nothing, never for a crossing.
 */

/**
 * The first leg (the stub out of the handle) is at most this long...
 *
 * Mermaid uses 30. Here the first leg runs from the handle to ELK's first
 * vertical channel, which sits further out (between-layer gap 110, edge-node
 * spacing 40); measured over the reference diagrams, 30 and 60 removed the
 * same jogs and 100 removed twelve more corners, with no crossing or label
 * overlap added. A jog tolerance above 16 started putting labels on top of
 * each other, so that one stays at Mermaid's value.
 */
const MAX_STUB = 100;
/** ...the jog after it is at most this tall... */
const MAX_JOG = 16;
/**
 * ...or this tall at the border of a container.
 *
 * ELK does not centre a container's ports the way it centres a leaf's: it
 * places them where its inner layout routes, so the jog onto the canvas's
 * handle there can be fifty pixels and more. Every edge into the container
 * then bridged at the same stub, and their bridges ran along one shared
 * vertical line. Measured 2026-10-22 over the reference and generated diagrams
 * (auto-layout path): vertical legs closer than 10px 4 → 2, crossings 130 →
 * 128, corners 964 → 956, label overlaps unchanged. Without the `obstacles`
 * guard it also put two routes through a node; with it, none.
 */
const MAX_CONTAINER_JOG = 200;
/** ...and taller than this, or there is nothing to straighten. */
const MIN_JOG = 0.01;

type Axis = "h" | "v";

function axisOf(a: Point, b: Point): Axis | null {
  const horizontal = Math.abs(a.y - b.y) < MIN_JOG;
  const vertical = Math.abs(a.x - b.x) < MIN_JOG;
  if (horizontal === vertical) return null;
  return horizontal ? "h" : "v";
}

/**
 * `[start, stub end, jog end, ...]` with the jog removed, or `null` when the
 * start of this polyline is not the stub-jog-continue shape.
 */
function straightenStart(points: readonly Point[], maxJog: number): Point[] | null {
  if (points.length < 5) return null;
  const [start, stubEnd, jogEnd, next] = points as [Point, Point, Point, Point];
  const axis = axisOf(start, stubEnd);
  if (axis === null || axisOf(jogEnd, next) !== axis) return null;
  if (axisOf(stubEnd, jogEnd) !== (axis === "h" ? "v" : "h")) return null;
  if (Math.hypot(stubEnd.x - start.x, stubEnd.y - start.y) > MAX_STUB) return null;

  const jog = Math.abs(axis === "h" ? jogEnd.y - stubEnd.y : jogEnd.x - stubEnd.x);
  if (jog < MIN_JOG || jog > maxJog) return null;
  // The run after the jog has to keep going the way the stub went; a jog
  // into a U-turn is a real turn, not noise.
  const sameWay =
    axis === "h"
      ? Math.sign(stubEnd.x - start.x) === Math.sign(next.x - jogEnd.x)
      : Math.sign(stubEnd.y - start.y) === Math.sign(next.y - jogEnd.y);
  if (!sameWay) return null;

  // The whole run on the jog's far side moves, up to the corner where it turns.
  let runEnd = 3;
  while (runEnd + 1 < points.length && axisOf(points[runEnd]!, points[runEnd + 1]!) === axis) {
    runEnd += 1;
  }
  // The run reaches the other endpoint: moving it would move a handle.
  if (runEnd === points.length - 1) return null;

  const out = points.map((point) => ({ x: point.x, y: point.y }));
  for (let i = 2; i <= runEnd; i += 1) {
    out[i] = axis === "h" ? { x: points[i]!.x, y: start.y } : { x: start.x, y: points[i]!.y };
  }
  out.splice(1, 2);
  return out;
}

/** Which ends of a route sit on a container's border. */
export interface ContainerEnds {
  source?: boolean;
  target?: boolean;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StraightenOptions {
  /** Per route id: which of its ends are on a container (`MAX_CONTAINER_JOG`). */
  containerEnds?: ReadonlyMap<string, ContainerEnds>;
  /**
   * Per route id: the nodes it must not be moved through — the leaves that are
   * not its own ends. A long jog moves a long run, and the run can land on a
   * node; a short one never moves far enough to.
   */
  obstacles?: ReadonlyMap<string, readonly Box[]>;
}

/** The polyline with the jog at either end removed, or the polyline itself. */
export function straightenPolyline(
  points: readonly Point[],
  containerEnds: ContainerEnds = {},
): readonly Point[] {
  const jogAt = (container: boolean | undefined) => (container ? MAX_CONTAINER_JOG : MAX_JOG);
  let out: readonly Point[] = straightenStart(points, jogAt(containerEnds.source)) ?? points;
  const reversed = straightenStart([...out].reverse(), jogAt(containerEnds.target));
  if (reversed) out = reversed.reverse();
  return out;
}

function nodesCrossed(points: readonly Point[], boxes: readonly Box[]): number {
  let count = 0;
  for (const box of boxes) {
    for (let i = 0; i < points.length - 1; i += 1) {
      if (segmentCrossesBox(points[i]!, points[i + 1]!, box)) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

function crossings(a: readonly Point[], b: readonly Point[]): number {
  let count = 0;
  for (let i = 0; i < a.length - 1; i += 1) {
    for (let j = 0; j < b.length - 1; j += 1) {
      if (segmentsIntersect(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!)) count += 1;
    }
  }
  return count;
}

/**
 * Straightens each polyline where that adds no crossing against the others,
 * and takes it through no node it did not already cross, in input order, each
 * against the routes as already straightened.
 *
 * @example
 * straightenPolylines(new Map([["e1", [source, ...corners, target]]]))
 */
export function straightenPolylines(
  polylines: ReadonlyMap<string, readonly Point[]>,
  options: StraightenOptions = {},
): Map<string, readonly Point[]> {
  const out = new Map(polylines);
  for (const [id, points] of polylines) {
    const straightened = straightenPolyline(points, options.containerEnds?.get(id));
    if (straightened === points) continue;

    const obstacles = options.obstacles?.get(id);
    if (obstacles && nodesCrossed(straightened, obstacles) > nodesCrossed(points, obstacles)) {
      continue;
    }

    let before = 0;
    let after = 0;
    for (const [otherId, other] of out) {
      if (otherId === id || other.length < 2) continue;
      before += crossings(points, other);
      after += crossings(straightened, other);
    }
    if (after <= before) out.set(id, straightened);
  }
  return out;
}
