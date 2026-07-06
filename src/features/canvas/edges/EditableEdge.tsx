import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useStore,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import {
  EdgeStyle,
  StrokeStyle,
  useActiveDiagramId,
  useDiagramActions,
  useEdgeLabelOffset,
  type Point,
} from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { buildEditableEdgePath } from "./geometry/paths";
import { clampOffset, getGhostMidpoints, getPointAtOffset } from "./geometry/projection";
import { useControlPoints } from "./interaction/useControlPoints";
import { useEdgeLabelDrag } from "./interaction/useEdgeLabelDrag";
import { ControlPoint, GhostControlPoint } from "./components/ControlPoint";
import { EdgeHitArea } from "./components/EdgeHitArea";
import { EdgeToolbar } from "./components/EdgeToolbar";
import { EdgeLabel } from "./components/EdgeLabel";
import { EdgeParticle } from "./overlays/EdgeParticle";
import { EdgePayloadOverlay } from "./overlays/EdgePayloadOverlay";
import { CollabEdgeHighlight } from "./overlays/CollabEdgeHighlight";
import type { EdgeData } from "./data/edgeData.types";

export type { EdgeData };

const DEFAULT_STROKE = "hsl(220 20% 30%)";
const HIGHLIGHT_STROKE = "hsl(187 72% 51%)";

const strokeDasharrayByStyle: Record<StrokeStyle, string | undefined> = {
  [StrokeStyle.Solid]: undefined,
  [StrokeStyle.Dashed]: "8 4",
  [StrokeStyle.Dotted]: "2 4",
};

type EditableEdgeType = Edge<EdgeData, "editable">;

const EditableEdge = memo((props: EdgeProps<EditableEdgeType>) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    markerEnd,
    markerStart,
  } = props;

  const edgeData = data ?? ({ label: "", connectionId: id } as EdgeData);
  const connectionId = edgeData.connectionId ?? id;

  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const { resetEdgeControlPoints, removeConnection } = useDiagramActions();
  const { highlightedConnectionId } = useHandleHighlight();

  const source = useMemo<Point>(() => ({ x: sourceX, y: sourceY }), [sourceX, sourceY]);
  const target = useMemo<Point>(() => ({ x: targetX, y: targetY }), [targetX, targetY]);

  // Read-only surfaces (viewer, playback) turn off selection; never edit there.
  const elementsSelectable = useStore((state) => state.elementsSelectable);
  const edgeStyle = edgeData.edgeStyle ?? EdgeStyle.Smoothstep;
  const isEditable = edgeStyle === EdgeStyle.Editable && elementsSelectable;

  const { points, activePointId, addPoint, removePoint, startPointDrag } =
    useControlPoints(connectionId);
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const storedLabelOffset = useEdgeLabelOffset(connectionId);
  const labelOffset = clampOffset(storedLabelOffset ?? edgeData.labelPosition);

  const [hovered, setHovered] = useState(false);

  const edgePath = useMemo(() => {
    if (isEditable) {
      return buildEditableEdgePath(source, target, points, "catmull-rom");
    }
    const params = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    if (edgeStyle === EdgeStyle.Step) return getSmoothStepPath({ ...params, borderRadius: 0 })[0];
    if (edgeStyle === EdgeStyle.Smoothstep) return getSmoothStepPath(params)[0];
    if (edgeStyle === EdgeStyle.Bezier) return getBezierPath(params)[0];
    return getStraightPath(params)[0];
  }, [
    isEditable,
    source,
    target,
    points,
    edgeStyle,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  ]);

  const labelPoint = useMemo(
    () => getPointAtOffset(source, target, points, labelOffset),
    [source, target, points, labelOffset],
  );

  const isHighlighted = Boolean(selected) || highlightedConnectionId === connectionId;
  const strokeStyle = edgeData.strokeStyle ?? StrokeStyle.Solid;
  const strokeWidth = edgeData.strokeWidth ?? 1;
  const baseStroke = edgeData.color ?? DEFAULT_STROKE;

  const showControlAffordances = isEditable && (Boolean(selected) || hovered) && !!activeDiagramId;
  const ghosts = useMemo(
    () => (showControlAffordances ? getGhostMidpoints(source, target, points) : []),
    [showControlAffordances, source, target, points],
  );

  const canDragLabel = Boolean(edgeData.label && activeDiagramId);
  const labelDrag = useEdgeLabelDrag({
    connectionId,
    enabled: canDragLabel,
    source,
    target,
    pointsRef,
  });

  const handleResetDoubleClick = (event: ReactMouseEvent<SVGPathElement>) => {
    if (!isEditable || points.length === 0 || !activeDiagramId) return;
    event.preventDefault();
    event.stopPropagation();
    resetEdgeControlPoints(activeDiagramId, connectionId);
  };

  const isActivePlayback = Boolean(edgeData.isActivePlayback);
  const payloadDirection = edgeData.activePayloadDirection ?? null;

  return (
    <>
      <g>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          markerStart={markerStart}
          interactionWidth={20}
          style={{
            stroke: isHighlighted ? HIGHLIGHT_STROKE : baseStroke,
            strokeWidth: isHighlighted ? Math.max(2, strokeWidth + 1) : strokeWidth,
            strokeDasharray: strokeDasharrayByStyle[strokeStyle],
          }}
        />
        <EdgeHitArea
          edgePath={edgePath}
          onHoverChange={setHovered}
          onDoubleClick={handleResetDoubleClick}
        />
        {showControlAffordances && (
          <>
            {ghosts.map((ghost) => (
              <GhostControlPoint
                key={`ghost-${ghost.insertIndex}`}
                ghost={ghost}
                ariaLabel={t("customEdge.addPointAria")}
                onAdd={addPoint}
              />
            ))}
            {points.map((point, index) => (
              <ControlPoint
                key={point.id}
                point={point}
                active={activePointId === point.id}
                ariaLabel={t("customEdge.controlPointAria", { index: index + 1 })}
                onPointerDown={startPointDrag}
                onRemove={removePoint}
              />
            ))}
          </>
        )}
        {isActivePlayback && <EdgeParticle edgePath={edgePath} direction={payloadDirection} />}
      </g>

      <CollabEdgeHighlight edgeId={connectionId} edgePath={edgePath} labelPoint={labelPoint} />

      {selected && elementsSelectable && (
        <EdgeToolbar
          anchor={labelPoint}
          canReset={isEditable && points.length > 0}
          onReset={() => activeDiagramId && resetEdgeControlPoints(activeDiagramId, connectionId)}
          onDelete={() => removeConnection(connectionId)}
        />
      )}

      {edgeData.label && (
        <EdgeLabel
          labelPoint={labelPoint}
          label={edgeData.label}
          technology={edgeData.technology}
          isHighlighted={isHighlighted}
          recordingBadges={edgeData.recordingBadges}
          isLastRecorded={edgeData.isLastRecorded}
          coverageFlowNames={edgeData.coverageFlowNames}
          playbackDuration={edgeData.playbackDuration}
          dragPath={null}
          labelPosition={labelOffset}
          connectionId={connectionId}
          canDrag={canDragLabel}
          onDragStart={labelDrag.handlePointerDown}
          onDragMove={labelDrag.handlePointerMove}
          onDragEnd={labelDrag.handlePointerUp}
        />
      )}

      {isActivePlayback && edgeData.activePayload && payloadDirection && (
        <EdgeLabelRenderer>
          <EdgePayloadOverlay
            labelPoint={labelPoint}
            labelOffsetY={edgeData.label ? 52 : 16}
            payload={edgeData.activePayload}
            direction={payloadDirection}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
});

EditableEdge.displayName = "EditableEdge";

export default EditableEdge;
