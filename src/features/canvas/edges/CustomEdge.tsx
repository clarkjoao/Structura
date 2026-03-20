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
import { useHandleHighlight } from "../contexts/HandleHighlightContext";

export interface EdgeData {
  label: string;
  technology?: string;
  connectionId: string;
  recordingBadges?: number[];
  isLastRecorded?: boolean;
  coverageFlowNames?: string[];
  playbackDuration?: string;
  isActivePlayback?: boolean;
  activePayload?: string | null;
  activePayloadDirection?: 'request' | 'response' | null;
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
}

const strokeDasharrayByStyle: Record<
  StrokeStyle | "solid",
  string | undefined
> = {
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
    const { highlightedConnectionId } = useHandleHighlight();
    const pathParams = {
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    };
    const styleKey = d?.edgeStyle ?? "smoothstep";
    let edgePath: string;
    let labelX: number;
    let labelY: number;
    if (styleKey === "step") {
      [edgePath, labelX, labelY] = getSmoothStepPath({
        ...pathParams,
        borderRadius: 0,
      });
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
    const isHighlighted =
      selected || highlightedConnectionId === d.connectionId;

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          markerStart={markerStart}
          style={{
            stroke: isHighlighted
              ? "hsl(187 72% 51%)"
              : d?.coverageFlowNames?.length
                ? "hsl(160 40% 38%)"
                : "hsl(220 20% 30%)",
            strokeWidth: isHighlighted
              ? Math.max(2, strokeWidth + 1)
              : strokeWidth,
            strokeDasharray: dashArray,
          }}
        />
        {d?.isActivePlayback && (
          <>
            <style>{`@keyframes flowParticle { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -112; } }`}</style>
            <path
              d={edgePath}
              fill="none"
              stroke={d.activePayloadDirection === "response" ? "hsl(152 60% 45%)" : "hsl(187 72% 51%)"}
              strokeWidth={2.5}
              strokeDasharray="6 106"
              strokeDashoffset={0}
              strokeLinecap="round"
              style={{
                animation: `flowParticle 1.2s linear infinite${d.activePayloadDirection === "response" ? " reverse" : ""}`,
                pointerEvents: "none",
              }}
            />
          </>
        )}
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
                  isHighlighted
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground"
                }`}
                title={
                  d?.coverageFlowNames?.length
                    ? `Coberto por: ${d.coverageFlowNames.join(", ")}`
                    : undefined
                }
              >
                {d?.recordingBadges && d.recordingBadges.length > 0 && (
                  <div
                    className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-0.5 ${d.isLastRecorded ? "animate-pulse" : ""}`}
                  >
                    {d.recordingBadges.join(",")}
                  </div>
                )}
                <span>{d.label}</span>
                {d.playbackDuration && (
                  <span className="ml-1 font-mono text-primary">
                    · {d.playbackDuration}
                  </span>
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
        {d?.isActivePlayback && d?.activePayload && (
          <EdgeLabelRenderer>
            <div
              className="absolute pointer-events-none"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + (d?.label ? 52 : 16)}px)`,
              }}
            >
              <div className={`rounded-md border bg-card/95 backdrop-blur-sm px-2.5 py-1.5 shadow-lg min-w-[160px] max-w-[260px] ${
                d.activePayloadDirection === "response"
                  ? "border-emerald-500/30"
                  : "border-cyan-500/30"
              }`}>
                <div className="flex items-center gap-1 mb-1">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    d.activePayloadDirection === "response" ? "text-emerald-400" : "text-cyan-400"
                  }`}>
                    {d.activePayloadDirection === "response" ? "← Response" : "→ Request"}
                  </span>
                </div>
                <pre className="text-[10px] font-mono text-foreground/90 whitespace-pre-wrap line-clamp-3 overflow-hidden">
                  {d.activePayload}
                </pre>
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
