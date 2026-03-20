import { MarkerType, type Edge } from "@xyflow/react";
import type { Connection, Diagram, FlowStep } from "@/features/diagram";
import { getEffectiveConnectionStyle } from "@/features/diagram";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../flow/flowState";

export interface EdgeBuildParams {
  diagram: Diagram;
  selectedEdgeId: string | null;
  isPlaying: boolean;
  isRecording: boolean;
  activeStep: FlowStep | null;
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds">;
  recordingInfo: Pick<RecordingInfo, "edgeSteps" | "recordedEdgeIds" | "lastEdgeId"> | null;
  coverage: Pick<CoverageInfo, "edgeFlows"> | null;
}

export function toMarkerType(
  marker: string | undefined,
): typeof MarkerType.Arrow | typeof MarkerType.ArrowClosed | undefined {
  if (!marker || marker === "none") return undefined;
  return marker === "arrowclosed" ? MarkerType.ArrowClosed : MarkerType.Arrow;
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
    return isActive ? 1 : isParticipant ? 0.5 : 0.2;
  }
  if (isRecording && recordingInfo) {
    return recordingInfo.recordedEdgeIds.has(connId) ? 1 : 0.2;
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
  const markerStart = effective.markerStart !== "none"
    ? toMarkerType(effective.markerStart)
    : undefined;

  const opacity = getEdgeOpacity(
    conn.id,
    params.isPlaying,
    params.isRecording,
    params.flowHighlight,
    params.recordingInfo,
  );

  return {
    id: conn.id,
    source: conn.sourceId,
    target: conn.targetId,
    sourceHandle: assignment?.sourceHandle,
    targetHandle: assignment?.targetHandle,
    type: "c4",
    data: {
      label: conn.label,
      technology: conn.technology,
      connectionId: conn.id,
      recordingBadges: params.recordingInfo?.edgeSteps.get(conn.id),
      isLastRecorded: params.recordingInfo?.lastEdgeId === conn.id,
      coverageFlowNames: params.coverage?.edgeFlows.get(conn.id),
      playbackDuration: isActiveConn ? params.activeStep?.duration : undefined,
      isActivePlayback: isActiveConn,
      activePayload: isActiveConn ? (params.activeStep?.payload ?? null) : null,
      activePayloadDirection: isActiveConn ? (params.activeStep?.payloadDirection ?? null) : null,
      edgeStyle: conn.style?.edgeStyle ?? "smoothstep",
      strokeStyle: effective.strokeStyle,
      strokeWidth: effective.strokeWidth,
    },
    selected: params.selectedEdgeId === conn.id,
    animated: isActiveConn || (effective.animated && !params.isPlaying),
    markerEnd: markerEnd !== undefined ? { type: markerEnd } : undefined,
    markerStart: markerStart !== undefined ? { type: markerStart } : undefined,
    style: opacity !== undefined ? { opacity } : undefined,
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
