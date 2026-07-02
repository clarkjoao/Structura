import type { RefObject } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { BaseEdge, type EdgeProps } from "@xyflow/react";
import { StrokeStyle } from "@/features/diagram";
import { EDGE_SEGMENT_HIGHLIGHT_STROKE_OPACITY } from "../canvas.constants";
import { EdgeParticle } from "./EdgeParticle";
import type { Segment } from "./edgeBuilding";

const SEGMENT_HIT_STROKE_WIDTH = 16;

const strokeDasharrayByStyle: Record<StrokeStyle, string | undefined> = {
  [StrokeStyle.Solid]: undefined,
  [StrokeStyle.Dashed]: "8 4",
  [StrokeStyle.Dotted]: "2 4",
};

export interface EdgeSvgLayerProps {
  edgeId: string;
  edgePath: string;
  markerEnd: EdgeProps["markerEnd"];
  markerStart: EdgeProps["markerStart"];
  waypointsLength: number;
  segments: Segment[];
  selected: boolean;
  hoveredSegmentIndex: number | null;
  onSegmentPointerDown: (segment: Segment) => (event: ReactPointerEvent<SVGLineElement>) => void;
  onSegmentHover: (index: number | null) => void;
  onEdgeWaypointsDoubleClick: (event: ReactMouseEvent<SVGPathElement | SVGLineElement>) => void;
  onWaypointDoubleClick: (index: number) => void;
  showSegmentHitTargets: boolean;
  isHighlighted: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  color?: string;
  coverageFlowNamesLength: number;
  segmentHitAriaLabel: (index: number) => string;
  isActivePlayback: boolean;
  activePayloadDirection: "request" | "response" | null;
  dragPathRef: RefObject<SVGPathElement | null>;
}

export function EdgeSvgLayer({
  edgeId,
  edgePath,
  markerEnd,
  markerStart,
  waypointsLength,
  segments,
  selected,
  hoveredSegmentIndex,
  onSegmentPointerDown,
  onSegmentHover,
  onEdgeWaypointsDoubleClick,
  onWaypointDoubleClick,
  showSegmentHitTargets,
  isHighlighted,
  strokeWidth,
  strokeStyle,
  color,
  segmentHitAriaLabel,
  isActivePlayback,
  activePayloadDirection,
  dragPathRef,
}: EdgeSvgLayerProps) {
  const dashArray = strokeDasharrayByStyle[strokeStyle];
  const defaultDataStroke = "hsl(220 20% 30%)";
  const baseStroke = color ?? defaultDataStroke;

  return (
    <g>
      <BaseEdge
        id={edgeId}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: isHighlighted ? "hsl(187 72% 51%)" : baseStroke,
          strokeWidth: isHighlighted ? Math.max(2, strokeWidth + 1) : strokeWidth,
          strokeDasharray: dashArray,
        }}
      />
      <path
        ref={dragPathRef}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: "stroke", cursor: "default" }}
        onDoubleClick={waypointsLength > 0 ? onEdgeWaypointsDoubleClick : undefined}
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
              aria-label={segmentHitAriaLabel(segment.index)}
              role="button"
              tabIndex={0}
              style={{
                cursor: segment.orientation === "horizontal" ? "ns-resize" : "ew-resize",
                pointerEvents: "stroke",
              }}
              onPointerDown={onSegmentPointerDown(segment)}
              onMouseEnter={() => onSegmentHover(segment.index)}
              onMouseLeave={() => onSegmentHover(null)}
              onDoubleClick={waypointsLength > 0 ? onEdgeWaypointsDoubleClick : undefined}
            />
            {(selected || hoveredSegmentIndex === segment.index) && (
              <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke="var(--color-text-info)"
                strokeWidth={selected ? 3 : 2}
                strokeOpacity={selected ? EDGE_SEGMENT_HIGHLIGHT_STROKE_OPACITY : 0.18}
                strokeLinecap="round"
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        ))}
      {showSegmentHitTargets && selected && waypointsLength > 0 &&
        segments.slice(0, waypointsLength).map((segment, k) => (
          <circle
            key={`wp-${k}`}
            cx={segment.x2}
            cy={segment.y2}
            r={4}
            fill="var(--color-background)"
            stroke="var(--color-text-info)"
            strokeWidth={1.5}
            style={{ pointerEvents: "all", cursor: "pointer" }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWaypointDoubleClick(k);
            }}
          />
        ))}
      {isActivePlayback && (
        <EdgeParticle edgePath={edgePath} direction={activePayloadDirection} />
      )}
    </g>
  );
}
