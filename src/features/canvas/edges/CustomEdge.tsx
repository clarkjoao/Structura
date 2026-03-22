import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import {
  useActiveDiagramId,
  useDiagramActions,
  useEdgeLabelOffset,
  useEdgeWaypoints,
  EdgeStyle,
  StrokeStyle,
  type ConnectionStyle,
  type Point,
} from "@/features/diagram";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { useTranslation } from "react-i18next";
import {
  buildOrthogonalPath,
  buildSegments,
  computeSegmentDrag,
  getClosestOffsetOnPath,
  getPointAtOffset,
  type Segment,
} from "./edgeBuilding";

const SEGMENT_HIT_STROKE_WIDTH = 12;

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
  activePayloadDirection?: "request" | "response" | null;
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
    const activeDiagramId = useActiveDiagramId();
    const { updateEdgeWaypoints, clearEdgeWaypoints, updateEdgeLabelOffset } =
      useDiagramActions();
    const lastSentLabelOffsetRef = useRef<number>(0.5);
    const d = data as unknown as EdgeData;
    const { highlightedConnectionId } = useHandleHighlight();
    const waypoints = useEdgeWaypoints(d?.connectionId ?? "");
    const layoutLabelOffset = useEdgeLabelOffset(d?.connectionId ?? "");
    const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
    const waypointsRef = useRef(waypoints);
    const windowPointerCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
      waypointsRef.current = waypoints;
    }, [waypoints]);

    useEffect(
      () => () => {
        windowPointerCleanupRef.current?.();
        windowPointerCleanupRef.current = null;
      },
      [],
    );

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
    if (waypoints.length > 0) {
      edgePath = buildOrthogonalPath(sourceX, sourceY, targetX, targetY, waypoints);
    } else if (styleKey === EdgeStyle.Step) {
      [edgePath] = getSmoothStepPath({
        ...pathParams,
        borderRadius: 0,
      });
    } else if (styleKey === EdgeStyle.Smoothstep) {
      [edgePath] = getSmoothStepPath(pathParams);
    } else if (styleKey === EdgeStyle.Bezier) {
      [edgePath] = getBezierPath(pathParams);
    } else {
      [edgePath] = getStraightPath(pathParams);
    }

    const effectiveLabelOffset = useMemo(() => {
      if (typeof layoutLabelOffset === "number" && !Number.isNaN(layoutLabelOffset)) {
        return clampLabelPosition(layoutLabelOffset);
      }
      return clampLabelPosition(d?.labelPosition);
    }, [layoutLabelOffset, d?.labelPosition]);

    const labelPoint = useMemo(
      () =>
        getPointAtOffset(
          sourceX,
          sourceY,
          targetX,
          targetY,
          waypoints,
          effectiveLabelOffset,
        ),
      [sourceX, sourceY, targetX, targetY, waypoints, effectiveLabelOffset],
    );

    const commitWaypoints = useCallback(
      (next: Point[]) => {
        if (!activeDiagramId || !d?.connectionId) return;
        waypointsRef.current = next;
        updateEdgeWaypoints(activeDiagramId, d.connectionId, next);
      },
      [activeDiagramId, d?.connectionId, updateEdgeWaypoints],
    );

    const endWindowPointerDrag = useCallback(() => {
      windowPointerCleanupRef.current?.();
      windowPointerCleanupRef.current = null;
      document.body.style.cursor = "";
    }, []);

    const startWindowPointerDrag = useCallback(
      (onMove: (pointerEvent: PointerEvent) => void, dragCursor: string) => {
        endWindowPointerDrag();
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          windowPointerCleanupRef.current = null;
          document.body.style.cursor = "";
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
        windowPointerCleanupRef.current = onUp;
        document.body.style.cursor = dragCursor;
      },
      [endWindowPointerDrag],
    );

    const handleSegmentPointerDown = useCallback(
      (segment: Segment) => {
        return (event: ReactPointerEvent<SVGLineElement>) => {
          if (!activeDiagramId || !d?.connectionId) return;
          event.preventDefault();
          event.stopPropagation();
          const initialWaypoints = waypointsRef.current.map((point) => ({ ...point }));
          const startPos = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          const dragCursor =
            segment.orientation === "horizontal" ? "ns-resize" : "ew-resize";
          const onMove = (pointerEvent: PointerEvent) => {
            const currentPos = screenToFlowPosition({
              x: pointerEvent.clientX,
              y: pointerEvent.clientY,
            });
            const delta: Point = {
              x: currentPos.x - startPos.x,
              y: currentPos.y - startPos.y,
            };
            const next = computeSegmentDrag(
              sourceX,
              sourceY,
              targetX,
              targetY,
              initialWaypoints,
              segment,
              delta,
            );
            commitWaypoints(next);
          };
          startWindowPointerDrag(onMove, dragCursor);
        };
      },
      [
        activeDiagramId,
        commitWaypoints,
        d?.connectionId,
        screenToFlowPosition,
        sourceX,
        sourceY,
        startWindowPointerDrag,
        targetX,
        targetY,
      ],
    );

    const segments = useMemo(
      () => buildSegments(sourceX, sourceY, targetX, targetY, waypoints),
      [sourceX, sourceY, targetX, targetY, waypoints],
    );

    const isHighlighted =
      selected || highlightedConnectionId === d.connectionId;

    const strokeStyle = d?.strokeStyle ?? StrokeStyle.Solid;
    const dashArray = strokeDasharrayByStyle[strokeStyle];
    const strokeWidth = d?.strokeWidth ?? 1;

    const canDragLabelAlongPath = Boolean(
      d?.label && activeDiagramId && d?.connectionId,
    );

    const handleLabelPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!canDragLabelAlongPath || !activeDiagramId || !d?.connectionId) return;
        event.preventDefault();
        event.stopPropagation();
        lastSentLabelOffsetRef.current = effectiveLabelOffset;
        const onMove = (pointerEvent: PointerEvent) => {
          const flowPoint = screenToFlowPosition({
            x: pointerEvent.clientX,
            y: pointerEvent.clientY,
          });
          const raw = getClosestOffsetOnPath(
            sourceX,
            sourceY,
            targetX,
            targetY,
            waypointsRef.current,
            flowPoint,
          );
          const clamped = Math.max(0.05, Math.min(0.95, raw));
          if (Math.abs(clamped - lastSentLabelOffsetRef.current) < 0.003) return;
          lastSentLabelOffsetRef.current = clamped;
          updateEdgeLabelOffset(activeDiagramId, d.connectionId, clamped);
        };
        startWindowPointerDrag(onMove, "grabbing");
      },
      [
        activeDiagramId,
        canDragLabelAlongPath,
        d?.connectionId,
        effectiveLabelOffset,
        screenToFlowPosition,
        sourceX,
        sourceY,
        startWindowPointerDrag,
        targetX,
        targetY,
        updateEdgeLabelOffset,
      ],
    );

    const handleEdgeWaypointsDoubleClick = useCallback(
      (event: ReactMouseEvent<SVGPathElement | SVGLineElement>) => {
        if (waypoints.length === 0) return;
        if (!activeDiagramId || !d?.connectionId) return;
        event.preventDefault();
        event.stopPropagation();
        clearEdgeWaypoints(activeDiagramId, d.connectionId);
      },
      [activeDiagramId, clearEdgeWaypoints, d?.connectionId, waypoints.length],
    );

    const showSegmentHitTargets = Boolean(activeDiagramId && d?.connectionId);

    return (
      <>
        <g>
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
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={20}
            style={{ pointerEvents: "stroke", cursor: "default" }}
            onDoubleClick={waypoints.length > 0 ? handleEdgeWaypointsDoubleClick : undefined}
          />
          {showSegmentHitTargets &&
            segments.map((segment) => (
              <g key={segment.index}>
                <line
                  x1={segment.x1}
                  y1={segment.y1}
                  x2={segment.x2}
                  y2={segment.y2}
                  stroke="transparent"
                  strokeWidth={SEGMENT_HIT_STROKE_WIDTH}
                  strokeLinecap="round"
                  aria-label={t("customEdge.segmentHitAria", { index: segment.index + 1 })}
                  role="button"
                  tabIndex={0}
                  style={{
                    cursor:
                      segment.orientation === "horizontal" ? "ns-resize" : "ew-resize",
                    pointerEvents: "stroke",
                  }}
                  onPointerDown={handleSegmentPointerDown(segment)}
                  onMouseEnter={() => {
                    setHoveredSegmentIndex(segment.index);
                  }}
                  onMouseLeave={() => {
                    setHoveredSegmentIndex(null);
                  }}
                  onDoubleClick={waypoints.length > 0 ? handleEdgeWaypointsDoubleClick : undefined}
                />
                {(selected || hoveredSegmentIndex === segment.index) && (
                  <line
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                    stroke="var(--color-text-info)"
                    strokeWidth={3}
                    strokeOpacity={0.35}
                    strokeLinecap="round"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            ))}
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
        </g>
        {d?.label && (
          <EdgeLabelRenderer>
            <div
              className={`nodrag nopan absolute pointer-events-auto ${canDragLabelAlongPath ? "cursor-grab active:cursor-grabbing" : ""}`}
              onPointerDown={handleLabelPointerDown}
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
