import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import type { Connection, Diagram, FlowStep } from "@/features/diagram";
import { useRecordingMode } from "../contexts/RecordingModeContext";
import { buildEdge, filterVisibleConnections } from "../models/edgeBuilding";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../models/flowState";

interface UseCanvasEdgesParams {
  diagram: Diagram | null | undefined;
  visibleConnections: Connection[];
  edgeHandleAssignments: { connId: string; sourceHandle: string; targetHandle: string }[];
  selectedEdgeId: string | null;
  isPlaying: boolean;
  activeStep: FlowStep | null;
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds">;
  recordingInfo: Pick<RecordingInfo, "edgeSteps" | "recordedEdgeIds" | "lastEdgeId"> | null;
  coverage: Pick<CoverageInfo, "edgeFlows"> | null;
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

    const visible = filterVisibleConnections(visibleConnections, diagram.snapshot.components);
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
