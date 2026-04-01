import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import type { Connection, Diagram, FlowStep } from "@/features/diagram";
import { getCachedCanvasSnapshot } from "@/features/diagram";
import { useFlowMode } from "../flow/FlowModeContext";
import { buildEdge, filterVisibleConnections } from "./edgeBuilding";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../flow/flowState";

interface UseCanvasEdgesParams {
  diagram: Diagram | null | undefined;
  visibleConnections: Connection[];
  edgeHandleAssignments: { connId: string; sourceHandle: string; targetHandle: string }[];
  selectedEdgeId: string | null;
  isPlaying: boolean;
  isCompareMode?: boolean;
  compareConnectionOpacity?: Record<string, number>;
  activeStep: FlowStep | null;
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds">;
  recordingInfo: Pick<RecordingInfo, "edgeSteps" | "recordedEdgeIds" | "lastEdgeId"> | null;
  coverage: Pick<CoverageInfo, "edgeFlows"> | null;
  /** Tags toggled off in the canvas tag filter (local state, not persisted) */
  visibleTags: Set<string>;
}

export function useCanvasEdges({
  diagram,
  visibleConnections,
  edgeHandleAssignments,
  selectedEdgeId,
  isPlaying,
  isCompareMode,
  compareConnectionOpacity,
  activeStep,
  flowHighlight,
  recordingInfo,
  coverage,
  visibleTags,
}: UseCanvasEdgesParams): Edge[] {
  const { isRecording } = useFlowMode();
  return useMemo(() => {
    if (!diagram) return [];

    const r = getCachedCanvasSnapshot(diagram);
    const visible = filterVisibleConnections(visibleConnections, r.components);
    const assignmentMap = new Map(edgeHandleAssignments.map((a) => [a.connId, a]));

    const isEndpointHiddenByTag = (componentId: string): boolean => {
      if (!visibleTags) return false;
      const component = r.components[componentId];
      if (!component?.tags?.length) {
        return false;
      }
      return component.tags.some((tag) => visibleTags.has(tag));
    };

    return visible.map((conn) => {
      const assignment = assignmentMap.get(conn.id);
      const sourceHidden = isEndpointHiddenByTag(conn.sourceId);
      const targetHidden = isEndpointHiddenByTag(conn.targetId);
      return buildEdge(conn, assignment, {
        diagram,
        selectedEdgeId,
        isPlaying,
        isRecording,
        isCompareMode,
        compareConnectionOpacity,
        activeStep,
        flowHighlight,
        recordingInfo,
        coverage,
        tagFilterEdgeDimmed: sourceHidden || targetHidden,
      });
    });
  }, [
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId,
    isPlaying,
    isCompareMode,
    compareConnectionOpacity,
    isRecording,
    activeStep,
    flowHighlight,
    recordingInfo,
    coverage,
    visibleTags,
  ]);
}
