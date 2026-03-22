import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import type { Connection, Diagram, FlowStep } from "@/features/diagram";
import { resolveSceneSnapshot } from "@/features/diagram";
import { useRecordingMode } from "../flow/RecordingModeContext";
import { buildEdge, filterVisibleConnections } from "./edgeBuilding";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../flow/flowState";

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

    const r = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
    const visible = filterVisibleConnections(visibleConnections, r.components);
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
