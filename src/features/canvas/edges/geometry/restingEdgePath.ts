import { getBezierPath, getSmoothStepPath, getStraightPath, type Position } from "@xyflow/react";
import { EdgeStyle, type EdgeControlPoint, type Point } from "@/features/diagram";
import { buildEditableEdgePath } from "./paths";
import {
  buildStepPath,
  defaultOrthogonalCorners,
  pathThroughPoints,
  verticalStepPathPoints,
} from "./orthogonal";
import { withoutMicroJogs } from "./lineHops";

export interface RestingEdgePathInput {
  edgeStyle: EdgeStyle;
  vertical: boolean;
  source: Point;
  target: Point;
  sourcePosition: Position;
  targetPosition: Position;
  /** The edge's stored waypoints (`data.layoutPoints`); empty for the default route. */
  layoutPoints: readonly EdgeControlPoint[];
}

/**
 * The path an edge draws at rest, without line hops: the same geometry
 * `EditableEdge` draws when no gesture is in progress and no other edge
 * crosses it. Shared so the far level of detail cannot drift from it.
 */
export function restingEdgePath({
  edgeStyle,
  vertical,
  source,
  target,
  sourcePosition,
  targetPosition,
  layoutPoints,
}: RestingEdgePathInput): string {
  if (edgeStyle === EdgeStyle.EditableStep) {
    const corners =
      layoutPoints.length > 0
        ? layoutPoints.map((p) => ({ x: p.x, y: p.y }))
        : defaultOrthogonalCorners(source, target, sourcePosition);
    return vertical
      ? pathThroughPoints(withoutMicroJogs(verticalStepPathPoints(source, target, corners)))
      : buildStepPath(source, target, corners);
  }
  if (edgeStyle === EdgeStyle.Editable) {
    return buildEditableEdgePath(source, target, [...layoutPoints], "catmull-rom");
  }
  const params = {
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition,
    targetPosition,
  };
  if (edgeStyle === EdgeStyle.Step) return getSmoothStepPath({ ...params, borderRadius: 0 })[0];
  if (edgeStyle === EdgeStyle.Smoothstep) return getSmoothStepPath(params)[0];
  if (edgeStyle === EdgeStyle.Bezier) return getBezierPath(params)[0];
  return getStraightPath(params)[0];
}
