import type { EdgePathType, Point } from "@/features/diagram";

/**
 * Pure SVG-path geometry for editable edges. These helpers take flow-space
 * coordinates and know nothing about React or the store — they are unit-tested
 * in isolation and reused by the edge component and the label/ghost logic.
 */

/** A handle position relative to a node, mirroring xyflow's Position enum. */
export type HandlePosition = "left" | "top" | "right" | "bottom";

const HANDLE_DIRECTIONS: Record<HandlePosition, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

const distance = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Port of xyflow's internal `getPoints()` (from @xyflow/system). Returns the
 * polyline that Smoothstep / Step edges trace through between two handles.
 * `getSmoothStepPath` and the (borderRadius: 0) Step variant render via
 * `getBend` joins on this exact polyline, so feeding it to `getPointAtOffset`
 * places the label on the visible path — including the bend.
 */
export function getStepPolylinePoints(params: {
  source: Point;
  sourcePosition: HandlePosition;
  target: Point;
  targetPosition: HandlePosition;
  offset?: number;
  stepPosition?: number;
}): Point[] {
  const { source, sourcePosition, target, targetPosition } = params;
  const offset = params.offset ?? 20;
  const stepPosition = params.stepPosition ?? 0.5;
  const sourceDir = HANDLE_DIRECTIONS[sourcePosition];
  const targetDir = HANDLE_DIRECTIONS[targetPosition];
  const sourceGapped: Point = {
    x: source.x + sourceDir.x * offset,
    y: source.y + sourceDir.y * offset,
  };
  const targetGapped: Point = {
    x: target.x + targetDir.x * offset,
    y: target.y + targetDir.y * offset,
  };
  const sourceGappedDir =
    sourceGapped.x !== targetGapped.x
      ? sourceGapped.x < targetGapped.x
      : sourceGapped.y < targetGapped.y;
  const dirAccessor: "x" | "y" = sourceGapped.x !== targetGapped.x ? "x" : "y";
  const currDir =
    dirAccessor === "x"
      ? sourceGappedDir
        ? 1
        : -1
      : sourceGappedDir
        ? 1
        : -1;

  const sourceGapOffset = { x: 0, y: 0 };
  const targetGapOffset = { x: 0, y: 0 };
  let points: Point[] = [];

  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
    let centerX: number;
    let centerY: number;
    if (dirAccessor === "x") {
      centerX = sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
      centerY = (sourceGapped.y + targetGapped.y) / 2;
    } else {
      centerX = (sourceGapped.x + targetGapped.x) / 2;
      centerY = sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
    }
    const verticalSplit: Point[] = [
      { x: centerX, y: sourceGapped.y },
      { x: centerX, y: targetGapped.y },
    ];
    const horizontalSplit: Point[] = [
      { x: sourceGapped.x, y: centerY },
      { x: targetGapped.x, y: centerY },
    ];
    points =
      sourceDir[dirAccessor] === currDir
        ? dirAccessor === "x"
          ? verticalSplit
          : horizontalSplit
        : dirAccessor === "x"
          ? horizontalSplit
          : verticalSplit;
  } else {
    const sourceTarget: Point = { x: sourceGapped.x, y: targetGapped.y };
    const targetSource: Point = { x: targetGapped.x, y: sourceGapped.y };
    if (dirAccessor === "x") {
      points = sourceDir.x === currDir ? [targetSource] : [sourceTarget];
    } else {
      points = sourceDir.y === currDir ? [sourceTarget] : [targetSource];
    }
    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
      if (diff <= offset) {
        const gapOffset = Math.min(offset - 1, offset - diff);
        if (sourceDir[dirAccessor] === currDir) {
          sourceGapOffset[dirAccessor] =
            (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
        } else {
          targetGapOffset[dirAccessor] =
            (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
        }
      }
    }
    if (sourcePosition !== targetPosition) {
      const dirAccessorOpposite: "x" | "y" = dirAccessor === "x" ? "y" : "x";
      const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite];
      const sourceGtTargetOppo =
        sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite];
      const sourceLtTargetOppo =
        sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite];
      const flipSourceTarget =
        (sourceDir[dirAccessor] === 1 &&
          ((!isSameDir && sourceGtTargetOppo) || (isSameDir && sourceLtTargetOppo))) ||
        (sourceDir[dirAccessor] !== 1 &&
          ((!isSameDir && sourceLtTargetOppo) || (isSameDir && sourceGtTargetOppo)));
      if (flipSourceTarget) {
        points = dirAccessor === "x" ? [sourceTarget] : [targetSource];
      }
    }
  }

  const gappedSource: Point = {
    x: sourceGapped.x + sourceGapOffset.x,
    y: sourceGapped.y + sourceGapOffset.y,
  };
  const gappedTarget: Point = {
    x: targetGapped.x + targetGapOffset.x,
    y: targetGapped.y + targetGapOffset.y,
  };
  const head =
    gappedSource.x !== points[0].x || gappedSource.y !== points[0].y ? [gappedSource] : [];
  const tail =
    gappedTarget.x !== points[points.length - 1].x ||
    gappedTarget.y !== points[points.length - 1].y
      ? [gappedTarget]
      : [];
  return [source, ...head, ...points, ...tail, target];
}

/**
 * Sample a cubic bezier curve defined by control points P0..P3 at the given
 * `t` (0..1). Mirrors xyflow's getBezierPath control-point computation.
 */
function sampleBezier(
  p0: Point,
  c0: Point,
  c1: Point,
  p1: Point,
  t: number,
): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * c0.x + 3 * mt * t * t * c1.x + t * t * t * p1.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * c0.y + 3 * mt * t * t * c1.y + t * t * t * p1.y,
  };
}

/**
 * xyflow's getControlWithCurvature: produces the cubic control points from
 * source/target and a curvature factor (default 0.25), respecting the handle
 * direction (Left/Right/Top/Bottom).
 */
function getBezierControl(
  pos: HandlePosition,
  source: Point,
  target: Point,
  curvature: number,
): Point {
  const sourceDir = HANDLE_DIRECTIONS[pos];
  const c = curvature;
  // xyflow computes the offset as the full source->target distance times the curvature factor.
  const offset = Math.max(distance(source, target) * c, 20);
  return {
    x: source.x + sourceDir.x * offset,
    y: source.y + sourceDir.y * offset,
  };
}

/**
 * Build a polyline that traces the rendered path of a non-editable edge style.
 *
 * - Straight: 2-knot chord [source, target].
 * - Step / Smoothstep: the same polyline xyflow's getSmoothStepPath draws,
 *   including the gapped handle and the corner resolution. Sampling this
 *   with getPointAtOffset places the label on the visible bend.
 * - Bezier: a polyline approximation (32 samples) of the cubic bezier
 *   xyflow renders. Curve samples are visually indistinguishable from the
 *   cubic at label-graphic resolution and let the same getPointAtOffset
 *   machinery drive placement and drag.
 *
 * Pure: same inputs always produce the same polyline, suitable for memo'd
 * consumers and unit tests.
 */
export function getRenderedPathKnots(params: {
  source: Point;
  target: Point;
  sourcePosition: HandlePosition;
  targetPosition: HandlePosition;
  style: "straight" | "bezier" | "step" | "smoothstep";
  curvature?: number;
}): Point[] {
  const { source, target, sourcePosition, targetPosition, style } = params;
  const curvature = params.curvature ?? 0.25;

  if (style === "straight") {
    return [source, target];
  }

  if (style === "bezier") {
    const c0 = getBezierControl(sourcePosition, source, target, curvature);
    const c1 = getBezierControl(targetPosition, target, source, curvature);
    const samples = 32;
    const knots: Point[] = [sampleBezier(source, c0, c1, target, 0)];
    for (let i = 1; i <= samples; i += 1) {
      knots.push(sampleBezier(source, c0, c1, target, i / samples));
    }
    return knots;
  }

  return getStepPolylinePoints({ source, sourcePosition, target, targetPosition });
}

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

// ─── Re-exported for use by the draw.io export service ─────────────────────────

/**
 * A handle position relative to a node, mirroring xyflow's Position enum.
 * Exported so the export service can import the type without depending on @xyflow/react.
 */
export type { HandlePosition };