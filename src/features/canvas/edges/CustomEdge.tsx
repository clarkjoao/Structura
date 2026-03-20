import { memo, useMemo, useRef } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useDiagramActions, EdgeStyle, StrokeStyle, type ConnectionStyle } from "@/features/diagram";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { useTranslation } from "react-i18next";

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
  labelPosition?: number;
  connectionStyle?: ConnectionStyle;
}

const strokeDasharrayByStyle: Record<StrokeStyle, string | undefined> = {
  [StrokeStyle.Solid]: undefined,
  [StrokeStyle.Dashed]: "8 4",
  [StrokeStyle.Dotted]: "2 4",
};

function clampLabelPosition(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function getLabelPointOnPath(
  path: string,
  t: number,
  fallbackX: number,
  fallbackY: number,
): { x: number; y: number } {
  if (typeof document === "undefined") {
    return { x: fallbackX, y: fallbackY };
  }

  try {
    const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svgPath.setAttribute("d", path);
    const length = svgPath.getTotalLength();
    const point = svgPath.getPointAtLength(length * clampLabelPosition(t));
    return { x: point.x, y: point.y };
  } catch {
    return { x: fallbackX, y: fallbackY };
  }
}

function getClosestLabelPositionOnPath(
  path: SVGPathElement,
  x: number,
  y: number,
): number {
  const totalLength = path.getTotalLength();
  const samples = 80;
  let bestT = 0.5;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const p = path.getPointAtLength(totalLength * t);
    const dx = p.x - x;
    const dy = p.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    }
  }

  return bestT;
}

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
    const { t } = useTranslation();
    const { screenToFlowPosition } = useReactFlow();
    const { updateConnection } = useDiagramActions();
    const dragPathRef = useRef<SVGPathElement | null>(null);
    const lastSentPositionRef = useRef<number>(
      clampLabelPosition((data as unknown as EdgeData | undefined)?.labelPosition),
    );
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
    const styleKey = d?.edgeStyle ?? EdgeStyle.Smoothstep;
    let edgePath: string;
    let labelX: number;
    let labelY: number;
    if (styleKey === EdgeStyle.Step) {
      [edgePath, labelX, labelY] = getSmoothStepPath({
        ...pathParams,
        borderRadius: 0,
      });
    } else if (styleKey === EdgeStyle.Smoothstep) {
      [edgePath, labelX, labelY] = getSmoothStepPath(pathParams);
    } else if (styleKey === EdgeStyle.Bezier) {
      [edgePath, labelX, labelY] = getBezierPath(pathParams);
    } else {
      [edgePath, labelX, labelY] = getStraightPath(pathParams);
    }

    const strokeStyle = d?.strokeStyle ?? StrokeStyle.Solid;
    const dashArray = strokeDasharrayByStyle[strokeStyle];
    const strokeWidth = d?.strokeWidth ?? 1;
    const labelPosition = clampLabelPosition(d?.labelPosition);
    const labelPoint = getLabelPointOnPath(edgePath, labelPosition, labelX, labelY);
    const dragPath = useMemo(() => {
      if (typeof document === "undefined") return null;
      try {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", edgePath);
        return p;
      } catch {
        return null;
      }
    }, [edgePath]);
    const isHighlighted =
      selected || highlightedConnectionId === d.connectionId;

    const commitLabelPosition = (nextPosition: number) => {
      const safePosition = clampLabelPosition(nextPosition);
      if (Math.abs(lastSentPositionRef.current - safePosition) < 0.005) return;
      lastSentPositionRef.current = safePosition;
      updateConnection(d.connectionId, {
        style: {
          ...(d.connectionStyle ?? {}),
          labelPosition: safePosition,
        },
      });
    };

    const handleLabelPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
      if (!dragPath) return;
      event.preventDefault();
      event.stopPropagation();
      dragPathRef.current = dragPath;
      lastSentPositionRef.current = labelPosition;
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleLabelPointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
      if (!dragPathRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const position = getClosestLabelPositionOnPath(dragPathRef.current, flowPoint.x, flowPoint.y);
      commitLabelPosition(position);
    };

    const handleLabelPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragPathRef.current = null;
    };

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
              className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
              onPointerDown={handleLabelPointerDown}
              onPointerMove={handleLabelPointerMove}
              onPointerUp={handleLabelPointerUp}
              onPointerCancel={handleLabelPointerUp}
              style={{
                transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px)`,
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
                    ? t("customEdge.coveredBy", { names: d.coverageFlowNames.join(", ") })
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
                transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y + (d?.label ? 52 : 16)}px)`,
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
                    {d.activePayloadDirection === "response" ? t("customEdge.response") : t("customEdge.request")}
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
