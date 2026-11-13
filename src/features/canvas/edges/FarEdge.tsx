import { memo } from "react";
import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import { EdgeStyle, StrokeStyle, type EdgeControlPoint } from "@/features/diagram";
import { useReadingDirection } from "../contexts/ReadingDirectionContext";
import { restingEdgePath } from "./geometry/restingEdgePath";
import { DEFAULT_STROKE, strokeDasharrayByStyle } from "./edgeStroke";
import type { EdgeData } from "./data/edgeData.types";

const NO_POINTS: EdgeControlPoint[] = [];

/**
 * An edge at the far level of detail: its stroke and arrowheads on the resting
 * path, clickable through React Flow's interaction path — and nothing else. No
 * label (hidden below `EDGE_LABEL_MIN_ZOOM` anyway), no line hops, no hover
 * affordances and none of the editing hooks, which is what made mounting
 * hundreds of edges on a zoom-out expensive.
 */
export const FarEdge = memo((props: EdgeProps<Edge<EdgeData, "editable">>) => {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const vertical = useReadingDirection() === "TB";
  const path = restingEdgePath({
    edgeStyle: data?.edgeStyle ?? EdgeStyle.EditableStep,
    vertical,
    source: { x: sourceX, y: sourceY },
    target: { x: targetX, y: targetY },
    sourcePosition,
    targetPosition,
    layoutPoints: data?.layoutPoints ?? NO_POINTS,
  });
  const strokeStyle = data?.strokeStyle ?? StrokeStyle.Solid;
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={props.markerEnd}
      markerStart={props.markerStart}
      interactionWidth={20}
      style={{
        stroke: data?.color ?? DEFAULT_STROKE,
        strokeWidth: data?.strokeWidth ?? 1,
        strokeDasharray: strokeDasharrayByStyle[strokeStyle],
      }}
    />
  );
});

FarEdge.displayName = "FarEdge";
