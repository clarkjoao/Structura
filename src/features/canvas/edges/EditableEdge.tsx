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
  useConnection,
  useDiagramActions,
  useEdgeLabelOffset,
  type ConnectionStyle,
  type Point,
} from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { buildEditableEdgePath, getRenderedPathKnots } from "./geometry/paths";
import { buildStepPath } from "./geometry/orthogonal";
import { clampOffset, getGhostMidpoints, getPointAtOffset } from "./geometry/projection";
import { useControlPoints } from "./interaction/useControlPoints";
import { useSegmentDrag } from "./interaction/useSegmentDrag";
import { useEdgeLabelDrag } from "./interaction/useEdgeLabelDrag";
import { ControlPoint, GhostControlPoint } from "./components/ControlPoint";
import { EdgeSegmentHandles } from "./components/EdgeSegmentHandles";
import { CornerHandles, GhostCorner } from "./components/CornerHandles";
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
const ALIGN_STROKE = "hsl(316 80% 63%)";

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
  const { resetEdgeControlPoints, removeConnection, updateConnection } = useDiagramActions();
  const connection = useConnection(connectionId);
  const { highlightedConnectionId } = useHandleHighlight();

  const source = useMemo<Point>(() => ({ x: sourceX, y: sourceY }), [sourceX, sourceY]);
  const target = useMemo<Point>(() => ({ x: targetX, y: targetY }), [targetX, targetY]);

  // Read-only surfaces (viewer, playback) turn off selection; never edit there.
  const elementsSelectable = useStore((state) => state.elementsSelectable);
  const edgeStyle = edgeData.edgeStyle ?? EdgeStyle.EditableStep;
  const isStep = edgeStyle === EdgeStyle.EditableStep;
  const isCurve = edgeStyle === EdgeStyle.Editable;
  const isEditable = (isCurve || isStep) && elementsSelectable;

  const { points, activePointId, snapGuides, addPoint, removePoint, startPointDrag, nudgePoint } =
    useControlPoints(connectionId);
  const segmentDrag = useSegmentDrag(connectionId, source, target, sourcePosition);

  // Label placement polyline:
//  - Editable (Curve/Step): control points (Curve) or orthogonal corners
//    (Step) — these are what the rendered path actually traces.
//  - Non-editable (Smoothstep / Step / Bezier / Straight): we build the
//    same polyline (or, for Bezier, a 32-sample approximation of the same
//    cubic) that xyflow's getSmoothStepPath / getBezierPath / getStraightPath
//    renders. Sampling this with getPointAtOffset places the label on the
//    visible path, including the Smoothstep/Step bend, and `labelOffset`
//    slides it end-to-end along that polyline. The polyline is built from
//    source/target/handles — never from the store's `points` — so stale
//    entries left over from a previous Editable style, a copy, or the
//    waypoints->points migration cannot detach the label.
  const projectionPoints = isEditable
    ? isStep
      ? segmentDrag.corners
      : points
    : getRenderedPathKnots({
        source,
        target,
        sourcePosition: sourcePosition as "left" | "top" | "right" | "bottom",
        targetPosition: targetPosition as "left" | "top" | "right" | "bottom",
        style:
          edgeStyle === EdgeStyle.Bezier
            ? "bezier"
            : edgeStyle === EdgeStyle.Step
              ? "step"
              : edgeStyle === EdgeStyle.Straight
                ? "straight"
                : "smoothstep",
      });
  const projectionRef = useRef<readonly Point[]>(projectionPoints);
  useEffect(() => {
    projectionRef.current = projectionPoints;
  }, [projectionPoints]);

  const storedLabelOffset = useEdgeLabelOffset(connectionId);
  const labelOffset = clampOffset(storedLabelOffset ?? edgeData.labelPosition);

  const [hovered, setHovered] = useState(false);

  const { edgePath } = useMemo(() => {
    if (isStep) {
      return { edgePath: buildStepPath(source, target, segmentDrag.corners) };
    }
    if (isCurve) {
      return { edgePath: buildEditableEdgePath(source, target, points, "catmull-rom") };
    }
    const params = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    if (edgeStyle === EdgeStyle.Step) {
      return { edgePath: getSmoothStepPath({ ...params, borderRadius: 0 })[0] };
    }
    if (edgeStyle === EdgeStyle.Smoothstep) {
      return { edgePath: getSmoothStepPath(params)[0] };
    }
    if (edgeStyle === EdgeStyle.Bezier) {
      return { edgePath: getBezierPath(params)[0] };
    }
    return { edgePath: getStraightPath(params)[0] };
  }, [
    isStep,
    isCurve,
    source,
    target,
    points,
    segmentDrag.corners,
    edgeStyle,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  ]);

  const labelPoint = useMemo(
    () => getPointAtOffset(source, target, projectionPoints, labelOffset),
    [source, target, projectionPoints, labelOffset],
  );

  const isHighlighted = Boolean(selected) || highlightedConnectionId === connectionId;
  const strokeStyle = edgeData.strokeStyle ?? StrokeStyle.Solid;
  const strokeWidth = edgeData.strokeWidth ?? 1;
  const baseStroke = edgeData.color ?? DEFAULT_STROKE;

  const showAffordances = isEditable && (Boolean(selected) || hovered) && !!activeDiagramId;
  const ghosts = useMemo(
    () => (showAffordances && isCurve ? getGhostMidpoints(source, target, points) : []),
    [showAffordances, isCurve, source, target, points],
  );

  // Add-a-bend affordances for step edges: a hollow square at the midpoint of
  // each segment long enough to hold one, hidden while a drag is in progress.
  const isDraggingStep =
    segmentDrag.activeSegmentIndex !== null || segmentDrag.activeCornerIndex !== null;
  const stepGhosts = useMemo(() => {
    if (!showAffordances || !isStep || isDraggingStep) return [];
    return segmentDrag.segments
      .filter((s) => Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1) > 28)
      .map((s) => ({
        segmentIndex: s.index,
        x: (s.x1 + s.x2) / 2,
        y: (s.y1 + s.y2) / 2,
      }));
  }, [showAffordances, isStep, isDraggingStep, segmentDrag.segments]);

  // Snap guides come from whichever editing surface is active for this style.
  const activeGuides = isStep ? segmentDrag.snapGuides : snapGuides;

  const canDragLabel = Boolean(edgeData.label && activeDiagramId);
  const labelDrag = useEdgeLabelDrag({
    connectionId,
    enabled: canDragLabel,
    source,
    target,
    pointsRef: projectionRef,
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
        {activeGuides.map((guide, index) => {
          const horizontal = guide.orientation === "horizontal";
          const isAlign = guide.kind === "align";
          return (
            <line
              key={`guide-${index}`}
              x1={horizontal ? guide.from : guide.position}
              y1={horizontal ? guide.position : guide.from}
              x2={horizontal ? guide.to : guide.position}
              y2={horizontal ? guide.position : guide.to}
              stroke={isAlign ? ALIGN_STROKE : "var(--color-text-info, hsl(187 72% 51%))"}
              strokeWidth={1}
              strokeOpacity={isAlign ? 0.9 : 0.4}
              strokeDasharray="4 4"
              style={{ pointerEvents: "none" }}
            />
          );
        })}
        {segmentDrag.previewPath && (
          <path
            d={segmentDrag.previewPath}
            fill="none"
            stroke="var(--color-text-info, hsl(187 72% 51%))"
            strokeWidth={2}
            strokeOpacity={0.5}
            style={{ pointerEvents: "none" }}
          />
        )}
        {showAffordances && isStep && (
          <>
            <EdgeSegmentHandles
              segments={segmentDrag.segments}
              activeSegmentIndex={segmentDrag.activeSegmentIndex}
              ariaLabel={(index) => t("customEdge.segmentHandleAria", { index: index + 1 })}
              onSegmentPointerDown={segmentDrag.startSegmentDrag}
            />
            <CornerHandles
              corners={segmentDrag.corners}
              activeCornerIndex={segmentDrag.activeCornerIndex}
              ariaLabel={(index) => t("customEdge.cornerHandleAria", { index: index + 1 })}
              onCornerPointerDown={segmentDrag.startCornerDrag}
              onCornerRemove={segmentDrag.removeCorner}
              onCornerNudge={segmentDrag.nudgeCorner}
            />
            {stepGhosts.map((ghost) => (
              <GhostCorner
                key={`bend-${ghost.segmentIndex}`}
                position={{ x: ghost.x, y: ghost.y }}
                ariaLabel={t("customEdge.addPointAria")}
                onAdd={() =>
                  segmentDrag.addCornerAt(ghost.segmentIndex, { x: ghost.x, y: ghost.y })
                }
              />
            ))}
          </>
        )}
        {showAffordances && isCurve && (
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
                onNudge={nudgePoint}
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
          edgeStyle={edgeStyle}
          edgeColor={connection?.style?.color}
          markerStart={connection?.style?.markerStart}
          markerEnd={connection?.style?.markerEnd}
          onStyleChange={(style) => {
            updateConnection(connectionId, {
              style: { ...(connection?.style ?? {}), edgeStyle: style } as ConnectionStyle,
            });
            // Reset any existing control points so the new style starts clean.
            if (
              activeDiagramId &&
              (style === EdgeStyle.Editable || style === EdgeStyle.EditableStep)
            ) {
              resetEdgeControlPoints(activeDiagramId, connectionId);
            }
          }}
          onColorChange={(color) =>
            updateConnection(connectionId, {
              style: { ...(connection?.style ?? {}), color } as ConnectionStyle,
            })
          }
          onMarkerStartChange={(cap) =>
            updateConnection(connectionId, {
              style: { ...(connection?.style ?? {}), markerStart: cap } as ConnectionStyle,
            })
          }
          onMarkerEndChange={(cap) =>
            updateConnection(connectionId, {
              style: { ...(connection?.style ?? {}), markerEnd: cap } as ConnectionStyle,
            })
          }
        />
      )}

      {edgeData.label && (
        <EdgeLabel
          labelPoint={labelPoint}
          label={edgeData.label}
          technology={edgeData.technology}
          isHighlighted={isHighlighted}
          stepBadges={edgeData.stepBadges}
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
