import type { Position } from "@xyflow/react";
import type { EdgeControlPoint, Point } from "@/features/diagram";
import { defaultOrthogonalCorners } from "./geometry/orthogonal";

/**
 * Step-path corners for EditableEdge: prefer stamped read-projection points,
 * else the store-backed corners (already defaulted to a mid-X Z when empty).
 *
 * @example
 * resolveStepCorners({
 *   layoutPoints: [{ id: "cp1", x: 10, y: 20 }],
 *   storeCorners: [{ x: 0, y: 0 }],
 *   source: { x: 0, y: 0 },
 *   target: { x: 100, y: 0 },
 *   sourcePosition: "right",
 * })
 */
export function resolveStepCorners(params: {
  layoutPoints: EdgeControlPoint[] | undefined;
  storeCorners: Point[];
  source: Point;
  target: Point;
  sourcePosition: Position | undefined;
}): Point[] {
  if (params.layoutPoints === undefined) return params.storeCorners;
  if (params.layoutPoints.length === 0) {
    return defaultOrthogonalCorners(params.source, params.target, params.sourcePosition);
  }
  return params.layoutPoints.map((point) => ({ x: point.x, y: point.y }));
}

/**
 * Curve control points: stamped layout wins when the key is present (including `[]`).
 */
export function resolveCurvePoints(params: {
  layoutPoints: EdgeControlPoint[] | undefined;
  storePoints: EdgeControlPoint[];
}): EdgeControlPoint[] {
  return params.layoutPoints !== undefined ? params.layoutPoints : params.storePoints;
}

/**
 * Label offset: stamp → store → legacy Connection.style.labelPosition.
 * A `null` stamp means the read projection had no offset for the edge: skip the
 * store (it belongs to another diagram) and use the legacy position.
 */
export function resolveLabelOffset(params: {
  layoutLabelOffset: number | null | undefined;
  storeLabelOffset: number | undefined;
  legacyLabelPosition: number | undefined;
}): number | undefined {
  if (params.layoutLabelOffset === null) return params.legacyLabelPosition;
  if (params.layoutLabelOffset !== undefined) return params.layoutLabelOffset;
  if (params.storeLabelOffset !== undefined) return params.storeLabelOffset;
  return params.legacyLabelPosition;
}
