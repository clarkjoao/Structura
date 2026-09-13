import { useMemo, useRef, type CSSProperties } from "react";
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

const EMPTY_EDGE_LIST: Edge[] = [];

/** Shallow own-key comparison, used for the nested objects buildEdge allocates fresh each call. */
function shallowEqualRecord(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Every field buildEdge sets. Compared by identity, which holds because the
 * nested objects are stabilised against the previous build before this runs.
 */
function isSameBuiltEdge(a: Edge, b: Edge): boolean {
  return (
    a.id === b.id &&
    a.source === b.source &&
    a.target === b.target &&
    a.sourceHandle === b.sourceHandle &&
    a.targetHandle === b.targetHandle &&
    a.type === b.type &&
    a.selected === b.selected &&
    a.animated === b.animated &&
    a.hidden === b.hidden &&
    a.zIndex === b.zIndex &&
    a.className === b.className &&
    a.data === b.data &&
    a.style === b.style &&
    a.markerEnd === b.markerEnd &&
    a.markerStart === b.markerStart
  );
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

  /**
   * Per-edge identity cache, mirroring the one useCanvasNodes keeps for nodes.
   *
   * Any dependency change used to rebuild every Edge object, so React Flow got
   * a fresh array of fresh objects and remounted the whole edge layer. A drag
   * frame never hits this -- nothing writes to the store during a gesture --
   * but the commit does, and so does every other store write.
   */
  const prevPartsRef = useRef<
    Map<
      string,
      {
        data: Record<string, unknown>;
        style: CSSProperties | undefined;
        markerEnd: Edge["markerEnd"];
        markerStart: Edge["markerStart"];
      }
    >
  >(new Map());
  const prevEdgesByIdRef = useRef<Map<string, Edge>>(new Map());
  const prevArrayRef = useRef<Edge[]>(EMPTY_EDGE_LIST);

  return useMemo(() => {
    if (!diagram) {
      prevPartsRef.current.clear();
      prevEdgesByIdRef.current.clear();
      prevArrayRef.current = EMPTY_EDGE_LIST;
      return EMPTY_EDGE_LIST;
    }

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

    const visibleIds = new Set(visible.map((conn) => conn.id));
    for (const cachedId of prevPartsRef.current.keys()) {
      if (!visibleIds.has(cachedId)) prevPartsRef.current.delete(cachedId);
    }
    for (const cachedId of prevEdgesByIdRef.current.keys()) {
      if (!visibleIds.has(cachedId)) prevEdgesByIdRef.current.delete(cachedId);
    }

    const pendingEdgeIds = getPendingEdgeIds(pendingPreviews);

    const nextEdges = visible.map((conn) => {
      const assignment = assignmentMap.get(conn.id);
      const sourceHidden = isEndpointHiddenByTag(conn.sourceId);
      const targetHidden = isEndpointHiddenByTag(conn.targetId);
      let edge = buildEdge(conn, assignment, {
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
      if (pendingEdgeIds.has(conn.id)) {
        edge = { ...edge, className: `${edge.className ?? ""} edge-pending`.trim() };
      }

      // Reuse the previous nested objects when their contents did not move, so
      // the identity comparison below can be a plain reference check.
      const cached = prevPartsRef.current.get(conn.id);
      const data = (edge.data ?? {}) as Record<string, unknown>;
      const stableData = cached && shallowEqualRecord(cached.data, data) ? cached.data : data;
      const stableStyle =
        cached &&
        shallowEqualRecord(
          cached.style as Record<string, unknown> | undefined,
          edge.style as Record<string, unknown> | undefined,
        )
          ? cached.style
          : (edge.style as CSSProperties | undefined);
      const stableMarkerEnd =
        cached &&
        shallowEqualRecord(
          cached.markerEnd as Record<string, unknown> | undefined,
          edge.markerEnd as Record<string, unknown> | undefined,
        )
          ? cached.markerEnd
          : edge.markerEnd;
      const stableMarkerStart =
        cached &&
        shallowEqualRecord(
          cached.markerStart as Record<string, unknown> | undefined,
          edge.markerStart as Record<string, unknown> | undefined,
        )
          ? cached.markerStart
          : edge.markerStart;
      prevPartsRef.current.set(conn.id, {
        data: stableData,
        style: stableStyle,
        markerEnd: stableMarkerEnd,
        markerStart: stableMarkerStart,
      });

      const built: Edge = {
        ...edge,
        data: stableData,
        style: stableStyle,
        markerEnd: stableMarkerEnd,
        markerStart: stableMarkerStart,
      };

      const prev = prevEdgesByIdRef.current.get(conn.id);
      if (prev && isSameBuiltEdge(prev, built)) return prev;
      prevEdgesByIdRef.current.set(conn.id, built);
      return built;
    });

    const prevArr = prevArrayRef.current;
    if (
      nextEdges.length === prevArr.length &&
      nextEdges.length > 0 &&
      nextEdges.every((edge, index) => edge === prevArr[index])
    ) {
      return prevArr;
    }
    if (nextEdges.length === 0) {
      prevArrayRef.current = EMPTY_EDGE_LIST;
      return EMPTY_EDGE_LIST;
    }
    prevArrayRef.current = nextEdges;
    return nextEdges;
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
