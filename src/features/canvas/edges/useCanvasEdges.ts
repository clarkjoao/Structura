import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import type { Connection, Diagram, DiagramModel, FlowStep } from "@/features/diagram";
import { getCachedCanvasSnapshot } from "@/features/diagram";
import { useFlowMode } from "../flow/FlowModeContext";
import { buildEdge, filterVisibleConnections } from "./data/buildEdges";
import type { FlowHighlight, FlowBadges, CoverageInfo } from "../flow/flowState";
import { getPendingEdgeIds, useLLMStore } from "@/features/llm";

interface UseCanvasEdgesParams {
  diagram: Diagram | DiagramModel | null | undefined;
  visibleConnections: Connection[];
  edgeHandleAssignments: { connId: string; sourceHandle: string; targetHandle: string }[];
  selectedEdgeId: string | null;
  isPlaying: boolean;
  isCompareMode?: boolean;
  compareConnectionOpacity?: Record<string, number>;
  activeStep: FlowStep | null;
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds" | "openFrameConnIds">;
  flowBadges: Pick<FlowBadges, "edgeLabels" | "badgedEdgeIds" | "lastEdgeId"> | null;
  coverage: Pick<CoverageInfo, "edgeFlows"> | null;
  visibleTags: Set<string> | null;
  visibleTagsKey: string | null;
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
  flowBadges,
  coverage,
  visibleTags: _visibleTags,
  visibleTagsKey,
}: UseCanvasEdgesParams): Edge[] {
  void _visibleTags;
  const { isRecording } = useFlowMode();
  const visibleTagsSet = useMemo(
    () => (visibleTagsKey ? new Set(visibleTagsKey.split("\x00").filter(Boolean)) : null),
    [visibleTagsKey],
  );
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  return useMemo(() => {
    if (!diagram) return [];

    const r = getCachedCanvasSnapshot(diagram);
    const visible = filterVisibleConnections(visibleConnections, r.components);
    const assignmentMap = new Map(edgeHandleAssignments.map((a) => [a.connId, a]));
    const isEndpointHiddenByTag = (componentId: string): boolean => {
      if (!visibleTagsSet) return false;
      const component = r.components[componentId];
      if (!component?.tags?.length) {
        return false;
      }
      return component.tags.some((tag) => visibleTagsSet.has(tag));
    };

    return visible.map((conn) => {
      const assignment = assignmentMap.get(conn.id);
      const sourceHidden = isEndpointHiddenByTag(conn.sourceId);
      const targetHidden = isEndpointHiddenByTag(conn.targetId);
      const edge = buildEdge(conn, assignment, {
        diagram,
        selectedEdgeId,
        isPlaying,
        isRecording,
        isCompareMode,
        compareConnectionOpacity,
        activeStep,
        flowHighlight,
        flowBadges,
        coverage,
        tagFilterEdgeDimmed: sourceHidden || targetHidden,
      });
      // Inline check — avoids a separate useMemo + Set lookup for the whole array.
      if (getPendingEdgeIds(pendingPreviews).has(conn.id)) {
        return {
          ...edge,
          className: `${edge.className ?? ""} edge-pending`.trim(),
        };
      }
      return edge;
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
    flowBadges,
    coverage,
    visibleTagsSet,
    pendingPreviews,
  ]);
}
