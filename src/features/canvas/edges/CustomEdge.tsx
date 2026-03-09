import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { EdgeStyle, StrokeStyle } from "@/features/diagram";

export interface EdgeData {
  label: string;
  technology?: string;
  connectionId: string;
  recordingBadges?: number[];
  isLastRecorded?: boolean;
  coverageFlowNames?: string[];
  playbackDuration?: string;
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
}

const strokeDasharrayByStyle: Record<StrokeStyle | "solid", string | undefined> = {
  solid: undefined,
  dashed: "8 4",
  dotted: "2 4",
};

const Edge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    selected,
    sourcePosition,
    targetPosition,
    markerEnd,
    markerStart,
  }: EdgeProps) => {
    const d = data as unknown as EdgeData;
    const pathParams = {
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    };
    const styleKey = d?.edgeStyle ?? "straight";
    let edgePath: string;
    let labelX: number;
    let labelY: number;
    if (styleKey === "step") {
      [edgePath, labelX, labelY] = getSmoothStepPath({ ...pathParams, borderRadius: 0 });
    } else if (styleKey === "smoothstep") {
      [edgePath, labelX, labelY] = getSmoothStepPath(pathParams);
    } else if (styleKey === "bezier") {
      [edgePath, labelX, labelY] = getBezierPath(pathParams);
    } else {
      [edgePath, labelX, labelY] = getStraightPath(pathParams);
    }

    const strokeStyle = d?.strokeStyle ?? "solid";
    const dashArray = strokeDasharrayByStyle[strokeStyle];
    const strokeWidth = d?.strokeWidth ?? 1;

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          markerStart={markerStart}
          style={{
            stroke: selected ? "hsl(187 72% 51%)" : (d?.coverageFlowNames?.length ? "hsl(160 40% 38%)" : "hsl(220 20% 30%)"),
            strokeWidth: selected ? Math.max(2, strokeWidth) : strokeWidth,
            strokeDasharray: dashArray,
          }}
        />
        {d?.label && (
          <EdgeLabelRenderer>
            <div
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              }}
            >
              <div
                className={`relative rounded-md px-2 py-1 text-[10px] font-medium border transition-colors ${
                  selected
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
                {d?.recordingBadges && d.recordingBadges.length > 0 && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-0.5 ${d.isLastRecorded ? "animate-pulse" : ""}`}>
                    {d.recordingBadges.join(",")}
                  </div>
                )}
                <span>{d.label}</span>
                {d.playbackDuration && (
                  <span className="ml-1 font-mono text-primary">· {d.playbackDuration}</span>
                )}
                {d.technology && (
                  <span className="block mt-0.5 font-mono text-[9px] bg-secondary px-1 rounded w-fit">
                    {d.technology}
                  </span>
                )}
              </div>
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  },
);

Edge.displayName = "Edge";

export default Edge;
