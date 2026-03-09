import { useMemo } from "react";
import { MarkerType, type Edge } from "@xyflow/react";
import type { Connection, Diagram, FlowStep } from "@/features/diagram";
import { getEffectiveConnectionStyle } from "@/features/diagram";

interface UseCanvasEdgesParams {
  diagram: Diagram | null | undefined;
  visibleConnections: Connection[];
  edgeHandleAssignments: { connId: string; sourceHandle: string; targetHandle: string }[];
  selectedEdgeId: string | null;
  isPlaying: boolean;
  isRecording: boolean | undefined;
  activeStep: FlowStep | null;
  flowHighlight: { activeConnId: string | null; participantConnIds: Set<string> };
  recordingInfo: {
    edgeSteps: Map<string, number[]>;
    recordedEdgeIds: Set<string>;
    lastEdgeId: string | null;
  } | null;
  coverage: { edgeFlows: Map<string, string[]> } | null;
}

export function useCanvasEdges({
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
}: UseCanvasEdgesParams): Edge[] {
  return useMemo(() => {
    if (!diagram) return [];
    const comps = diagram.snapshot.components;
    const connectionsToShow = visibleConnections.filter((conn) => {
      const src = comps[conn.sourceId];
      const tgt = comps[conn.targetId];
      return !src?.hidden && !tgt?.hidden;
    });
    const assignmentMap = new Map(edgeHandleAssignments.map((a) => [a.connId, a]));
    return connectionsToShow.map((conn) => {
      const assignment = assignmentMap.get(conn.id);
      const isActiveConn = isPlaying && flowHighlight.activeConnId === conn.id;
      const isParticipantConn = isPlaying && flowHighlight.participantConnIds.has(conn.id);
      const effective = getEffectiveConnectionStyle(conn);
      const markerEndType =
        effective.markerEnd === "none" ? undefined : effective.markerEnd === "arrow" ? MarkerType.Arrow : MarkerType.ArrowClosed;
      const markerStartType =
        effective.markerStart !== "none" ? (effective.markerStart === "arrowclosed" ? MarkerType.ArrowClosed : MarkerType.Arrow) : undefined;
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
          recordingBadges: recordingInfo?.edgeSteps.get(conn.id),
          isLastRecorded: recordingInfo?.lastEdgeId === conn.id,
          coverageFlowNames: coverage?.edgeFlows.get(conn.id),
          playbackDuration: isPlaying && flowHighlight.activeConnId === conn.id ? activeStep?.duration : undefined,
          edgeStyle: conn.style?.edgeStyle,
          strokeStyle: effective.strokeStyle,
          strokeWidth: effective.strokeWidth,
        },
        selected: selectedEdgeId === conn.id,
        animated: isActiveConn || (effective.animated && !isPlaying),
        markerEnd: markerEndType !== undefined ? { type: markerEndType } : undefined,
        markerStart: markerStartType !== undefined ? { type: markerStartType } : undefined,
        style: isPlaying
          ? { opacity: isActiveConn ? 1 : isParticipantConn ? 0.5 : 0.2 }
          : isRecording
            ? { opacity: recordingInfo?.recordedEdgeIds.has(conn.id) ? 1 : 0.2 }
            : undefined,
      };
    });
  }, [
    diagram, visibleConnections, edgeHandleAssignments, selectedEdgeId,
    isPlaying, flowHighlight, isRecording, recordingInfo, coverage, activeStep,
  ]);
}
