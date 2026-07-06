import type { CSSProperties } from "react";
import { MarkerType, type Edge } from "@xyflow/react";
import type { Connection, Diagram, DiagramModel, FlowStep } from "@/features/diagram";
import { getEffectiveConnectionStyle, EdgeMarker, EdgeStyle } from "@/features/diagram";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../../flow/flowState";
import {
  OPACITY_FLOW_PLAYBACK_EDGE_DIM,
  OPACITY_FLOW_PLAYBACK_PARTICIPANT,
  OPACITY_TAG_FILTER_EDGE_DIM,
} from "../../canvas.constants";

/** Maps domain connections onto React Flow edges. Pure data — no geometry or React. */

export interface EdgeBuildParams {
  diagram: Diagram | DiagramModel;
  selectedEdgeId: string | null;
  isPlaying: boolean;
  isRecording: boolean;
  isCompareMode?: boolean;

  compareConnectionOpacity?: Record<string, number>;
  activeStep: FlowStep | null;
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds">;
  recordingInfo: Pick<RecordingInfo, "edgeSteps" | "recordedEdgeIds" | "lastEdgeId"> | null;
  coverage: Pick<CoverageInfo, "edgeFlows"> | null;

  tagFilterEdgeDimmed?: boolean;
}

export function toMarkerType(
  marker: string | undefined,
): typeof MarkerType.Arrow | typeof MarkerType.ArrowClosed | undefined {
  if (!marker || marker === EdgeMarker.None) return undefined;
  return marker === EdgeMarker.ArrowClosed ? MarkerType.ArrowClosed : MarkerType.Arrow;
}

/**
 * React Flow markers use markerUnits="strokeWidth" with viewBox="-10 -10 20 20".
 * The arrow polyline occupies 5/20 (25%) of the viewBox width, so:
 *   visible_px = (5/20) × markerWidth × strokeWidth
 * Default width=12.5 gives only ~3px for strokeWidth=1 — too small.
 * We target ~8px visible width at any strokeWidth by computing the inverse.
 */
function buildMarkerDef(type: MarkerType, strokeWidth: number) {
  const targetPx = 8;
  const w = Math.round(targetPx / (0.25 * strokeWidth));
  const h = Math.round(w * 1.5);
  return { type, width: w, height: h, strokeWidth: 1.5 };
}

export function getEdgeOpacity(
  connId: string,
  isPlaying: boolean,
  isRecording: boolean,
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds">,
  recordingInfo: Pick<RecordingInfo, "recordedEdgeIds"> | null,
): number | undefined {
  if (isPlaying) {
    const isActive = flowHighlight.activeConnId === connId;
    const isParticipant = flowHighlight.participantConnIds.has(connId);
    return isActive
      ? 1
      : isParticipant
        ? OPACITY_FLOW_PLAYBACK_PARTICIPANT
        : OPACITY_FLOW_PLAYBACK_EDGE_DIM;
  }
  if (isRecording && recordingInfo) {
    return recordingInfo.recordedEdgeIds.has(connId) ? 1 : OPACITY_FLOW_PLAYBACK_EDGE_DIM;
  }
  return undefined;
}

export function buildEdge(
  conn: Connection,
  assignment: { sourceHandle: string; targetHandle: string } | undefined,
  params: EdgeBuildParams,
): Edge {
  const effective = getEffectiveConnectionStyle(conn);
  const isActiveConn = params.isPlaying && params.flowHighlight.activeConnId === conn.id;

  const markerEnd = toMarkerType(effective.markerEnd);
  const markerStart =
    effective.markerStart !== EdgeMarker.None ? toMarkerType(effective.markerStart) : undefined;

  const flowOpacity = getEdgeOpacity(
    conn.id,
    params.isPlaying,
    params.isRecording,
    params.flowHighlight,
    params.recordingInfo,
  );
  const compareOp =
    params.isCompareMode && params.compareConnectionOpacity
      ? params.compareConnectionOpacity[conn.id]
      : undefined;
  const opacity = compareOp !== undefined ? compareOp : flowOpacity;
  const tagDimmed = params.tagFilterEdgeDimmed === true;
  const edgeColor = conn.style?.color;
  const stylePayload =
    opacity !== undefined || edgeColor
      ? {
          ...(opacity !== undefined ? { opacity } : {}),
          ...(edgeColor ? { stroke: edgeColor } : {}),
        }
      : undefined;
  const edgeStyle: CSSProperties | undefined = tagDimmed
    ? {
        opacity: OPACITY_TAG_FILTER_EDGE_DIM,
        pointerEvents: "none",
        transition: "opacity 0.2s ease",
      }
    : stylePayload;

  return {
    id: conn.id,
    source: conn.sourceId,
    target: conn.targetId,
    sourceHandle: assignment?.sourceHandle,
    targetHandle: assignment?.targetHandle,
    type: "editable",
    data: {
      label: conn.label,
      technology: conn.technology,
      color: conn.style?.color,
      connectionId: conn.id,
      recordingBadges: params.recordingInfo?.edgeSteps.get(conn.id),
      isLastRecorded: params.recordingInfo?.lastEdgeId === conn.id,
      coverageFlowNames: params.coverage?.edgeFlows.get(conn.id),
      playbackDuration: isActiveConn ? params.activeStep?.duration : undefined,
      isActivePlayback: isActiveConn,
      activePayload: isActiveConn ? (params.activeStep?.payload ?? null) : null,
      activePayloadDirection: isActiveConn ? (params.activeStep?.payloadDirection ?? null) : null,
      edgeStyle: conn.style?.edgeStyle ?? EdgeStyle.Smoothstep,
      strokeStyle: effective.strokeStyle,
      strokeWidth: effective.strokeWidth,
      labelPosition: conn.style?.labelPosition,
      connectionStyle: conn.style,
    },
    selected: params.selectedEdgeId === conn.id,
    animated: isActiveConn || (effective.animated && !params.isPlaying),
    markerEnd:
      markerEnd !== undefined ? buildMarkerDef(markerEnd, effective.strokeWidth) : undefined,
    markerStart:
      markerStart !== undefined ? buildMarkerDef(markerStart, effective.strokeWidth) : undefined,
    style: edgeStyle,
  };
}

export function filterVisibleConnections(
  connections: Connection[],
  components: Record<string, { hidden?: boolean }>,
): Connection[] {
  return connections.filter((conn) => {
    const src = components[conn.sourceId];
    const tgt = components[conn.targetId];
    return !src?.hidden && !tgt?.hidden;
  });
}
