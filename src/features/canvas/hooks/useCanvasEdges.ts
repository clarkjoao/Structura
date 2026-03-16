import { useMemo } from "react";
import { MarkerType, type Edge } from "@xyflow/react";
import type { Connection, Diagram, FlowStep } from "@/features/diagram";
import { getEffectiveConnectionStyle } from "@/features/diagram";
import { useRecordingMode } from "../contexts/RecordingModeContext";

interface UseCanvasEdgesParams {
  diagram: Diagram | null | undefined;
  visibleConnections: Connection[];
  edgeHandleAssignments: { connId: string; sourceHandle: string; targetHandle: string }[];
  selectedEdgeId: string | null;
  isPlaying: boolean;
  activeStep: FlowStep | null;
  flowHighlight: { activeConnId: string | null; participantConnIds: Set<string> };
  recordingInfo: {
    edgeSteps: Map<string, number[]>;
    recordedEdgeIds: Set<string>;
    lastEdgeId: string | null;
  } | null;
  coverage: { edgeFlows: Map<string, string[]> } | null;
}

function toMarkerType(marker: string | undefined): typeof MarkerType.Arrow | typeof MarkerType.ArrowClosed | undefined {
  if (!marker || marker === "none") return undefined;
  return marker === "arrowclosed" ? MarkerType.ArrowClosed : MarkerType.Arrow;
}

function getEdgeOpacity(
  connId: string,
  isPlaying: boolean,
  isRecording: boolean | undefined,
  flowHighlight: UseCanvasEdgesParams["flowHighlight"],
  recordingInfo: UseCanvasEdgesParams["recordingInfo"],
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

function buildEdge(
  conn: Connection,
  assignment: { sourceHandle: string; targetHandle: string } | undefined,
  params: {
    diagram: Diagram;
    selectedEdgeId: string | null;
    isPlaying: boolean;
    isRecording: boolean | undefined;
    activeStep: FlowStep | null;
    flowHighlight: UseCanvasEdgesParams["flowHighlight"];
    recordingInfo: UseCanvasEdgesParams["recordingInfo"];
    coverage: UseCanvasEdgesParams["coverage"];
  },
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
      edgeStyle: conn.style?.edgeStyle,
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

export function useCanvasEdges({
  diagram,
  visibleConnections,
  edgeHandleAssignments,
  selectedEdgeId,
  isPlaying,
  activeStep,
  flowHighlight,
  recordingInfo,
  coverage,
}: UseCanvasEdgesParams): Edge[] {
  const { isRecording } = useRecordingMode();
  return useMemo(() => {
    if (!diagram) return [];

    const comps = diagram.snapshot.components;
    const visible = visibleConnections.filter((conn) => {
      const src = comps[conn.sourceId];
      const tgt = comps[conn.targetId];
      return !src?.hidden && !tgt?.hidden;
    });

    const assignmentMap = new Map(edgeHandleAssignments.map((a) => [a.connId, a]));

    return visible.map((conn) => {
      const assignment = assignmentMap.get(conn.id);
      return buildEdge(conn, assignment, {
        diagram,
        selectedEdgeId,
        isPlaying,
        isRecording,
        activeStep,
        flowHighlight,
        recordingInfo,
        coverage,
      });
    });
  }, [
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId,
    isPlaying,
    isRecording,
    activeStep,
    flowHighlight,
    recordingInfo,
    coverage,
  ]);
}
