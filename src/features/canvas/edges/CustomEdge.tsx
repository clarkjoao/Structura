import { memo } from "react";
import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { EdgeLabel } from "./EdgeLabel";
import { EdgePayloadOverlay } from "./EdgePayloadOverlay";
import { EdgeSvgLayer } from "./EdgeSvgLayer";
import { useCustomEdge } from "./useCustomEdge";
import type { EdgeData } from "./edgeData.types";
import { useCollabHighlight } from "@/features/collaboration";

export type { EdgeData };

const Edge = memo((props: EdgeProps) => {
  const core = useCustomEdge(props);
  const collabHighlight = useCollabHighlight(core.edgeData?.connectionId ?? core.id);
  return (
    <>
      <EdgeSvgLayer
        edgeId={core.id}
        edgePath={core.edgePath}
        markerEnd={core.markerEnd}
        markerStart={core.markerStart}
        waypointsLength={core.waypoints.length}
        segments={core.segments}
        selected={core.selected ?? false}
        hoveredSegmentIndex={core.hoveredSegmentIndex}
        onSegmentPointerDown={core.handleSegmentPointerDown}
        onSegmentHover={core.setHoveredSegmentIndex}
        onEdgeWaypointsDoubleClick={core.handleEdgeWaypointsDoubleClick}
        onWaypointDoubleClick={core.handleWaypointDoubleClick}
        showSegmentHitTargets={core.showSegmentHitTargets}
        isHighlighted={core.isHighlighted}
        strokeWidth={core.strokeWidth}
        strokeStyle={core.strokeStyle}
        color={core.edgeData?.color}
        coverageFlowNamesLength={core.edgeData?.coverageFlowNames?.length ?? 0}
        segmentHitAriaLabel={(index) => core.t("customEdge.segmentHitAria", { index: index + 1 })}
        isActivePlayback={Boolean(core.edgeData?.isActivePlayback)}
        activePayloadDirection={core.edgeData?.activePayloadDirection ?? null}
        dragPathRef={core.labelDrag.dragPathRef}
      />
      {collabHighlight && (
        <>
          <path
            d={core.edgePath}
            strokeWidth={4}
            stroke={collabHighlight.color}
            fill="none"
            strokeOpacity={0.5}
            style={{ pointerEvents: "none" }}
          />
          <EdgeLabelRenderer>
            <div
              className="absolute pointer-events-none z-[2] text-[9px] font-semibold
                         text-white px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{
                transform: `translate(-50%, -50%) translate(${core.labelPoint.x}px, ${core.labelPoint.y}px)`,
                backgroundColor: collabHighlight.color,
              }}
            >
              {collabHighlight.userName}
            </div>
          </EdgeLabelRenderer>
        </>
      )}
      {core.edgeData?.label && (
        <EdgeLabel
          labelPoint={core.labelPoint}
          label={core.edgeData.label}
          technology={core.edgeData.technology}
          isHighlighted={core.isHighlighted}
          recordingBadges={core.edgeData.recordingBadges}
          isLastRecorded={core.edgeData.isLastRecorded}
          coverageFlowNames={core.edgeData.coverageFlowNames}
          playbackDuration={core.edgeData.playbackDuration}
          dragPath={core.labelDrag.dragPathRef.current}
          labelPosition={core.effectiveLabelOffset}
          connectionId={core.edgeData.connectionId}
          canDrag={core.canDragLabelAlongPath}
          onDragStart={core.labelDrag.handlePointerDown}
          onDragMove={core.labelDrag.handlePointerMove}
          onDragEnd={core.labelDrag.handlePointerUp}
        />
      )}
      {core.edgeData?.isActivePlayback &&
        core.edgeData?.activePayload &&
        core.edgeData.activePayloadDirection && (
          <EdgeLabelRenderer>
            <EdgePayloadOverlay
              labelPoint={core.labelPoint}
              labelOffsetY={core.edgeData.label ? 52 : 16}
              payload={core.edgeData.activePayload}
              direction={core.edgeData.activePayloadDirection}
            />
          </EdgeLabelRenderer>
        )}
    </>
  );
});

Edge.displayName = "Edge";

export default Edge;
