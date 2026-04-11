import { useMemo, useRef, type CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import type {
  CompareElementVisual,
  Component,
  ComponentPatch,
  Diagram,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import {
  isPanelComponent,
  isApiGroupComponent,
  isEndpointType,
  isComponentAddedInActiveScene,
  isAncestorLocked,
} from "@/features/diagram";
import { resolveNodeDescriptor, type NodeBuildContext } from "./node-types";
import { useFlowMode } from "../flow/FlowModeContext";
import { buildCollapsedPanelIds, computeNodeVisibility } from "./nodeVisibility";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../flow/flowState";
import { OPACITY_FLOW_PLAYBACK_NODE_DIM, OPACITY_TAG_FILTER_DIM } from "../canvas.constants";
import { getPendingNodeIds, useLLMStore } from "@/features/llm";

interface UseCanvasNodesParams {
  diagram: Diagram | null | undefined;
  resolvedComponents: Record<string, Component>;
  resolvedNodeLayouts: Record<string, NodeLayout>;
  sceneBadgeByComponentId: Record<string, { name: string; color: string }>;
  visibleComponents: Component[];
  panelIds: Set<string>;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  handleDrillDown: (id: string) => void;
  handlePanelCollapseToggle: (id: string) => void;
  isPlaying: boolean;
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  connectionCountPerNode: Record<string, { incoming: number; outgoing: number }>;
  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>;
  onReorderHandle?: (nodeId: string, side: "incoming" | "outgoing", connId: string, direction: "up" | "down") => void;
  flowHighlight: FlowHighlight;
  activeStep: import("@/features/diagram").FlowStep | null;
  recordingInfo: RecordingInfo | null;
  coverage: CoverageInfo | null;
  isViewingCoverage: boolean;
  activeFlowId?: string | null;
  onPlayFlow?: (flowId: string) => void;
  onAddEndpointToGroup?: (groupId: string) => void;
  isCompareMode?: boolean;
  compareVisualByComponentId?: Record<string, CompareElementVisual>;
  isNodeHiddenByTagFilter: (component: Component) => boolean;
  onNoteStartEdit?: (noteId: string) => void;
  setNoteInlineEditingId?: (id: string | null) => void;
  onJsonViewerStartEdit?: (nodeId: string) => void;
  setJsonViewerInlineEditingId?: (id: string | null) => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
}

type NodeCtxBase = Omit<NodeBuildContext, "isPlaying" | "isRecording" | "flowHighlight" | "activeStep" | "recordingInfo" | "coverage"> & {
  highlightedNodeIds: Set<string>;
  isViewingCoverage: boolean;
};

const EMPTY_JOURNEYS_BY_COMPONENT_ID: Record<string, { name: string }[]> =
  Object.freeze({});

function compareDiffOutlineClass(
  visual: CompareElementVisual | undefined,
): string {
  if (!visual) return "";
  const hasA = visual.badgeA !== undefined;
  const hasB = visual.badgeB !== undefined;
  if (hasA && hasB) return "node-diff-modified";
  if (hasA && !hasB) return "node-diff-removed";
  if (!hasA && hasB) return "node-diff-added";
  return "";
}

/**
 * Fix C helpers — shallow equality that ignores function values.
 * buildData returns closures that are always new objects; treating all
 * function-valued keys as equal prevents needless data-reference churn.
 */
function shallowEqualIgnoringFunctions(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (typeof a[key] === "function" && typeof b[key] === "function") continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function shallowEqualStyle(
  a: CSSProperties | undefined,
  b: CSSProperties | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a) as (keyof CSSProperties)[];
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function useCanvasNodes({
  diagram,
  resolvedComponents,
  resolvedNodeLayouts,
  sceneBadgeByComponentId,
  visibleComponents,
  panelIds,
  selectedNodeId,
  selectedNodeIds,
  highlightedNodeIds,
  serviceRegistry,
  allDiagrams,
  handleDrillDown,
  handlePanelCollapseToggle,
  isPlaying,
  dragTargetPanelId,
  unparentCandidatePanelId,
  connectionCountPerNode,
  effectiveHandleOrder,
  onReorderHandle,
  flowHighlight,
  activeStep,
  recordingInfo,
  coverage,
  isViewingCoverage,
  activeFlowId,
  onPlayFlow,
  onAddEndpointToGroup,
  isCompareMode = false,
  compareVisualByComponentId,
  isNodeHiddenByTagFilter,
  onNoteStartEdit,
  setNoteInlineEditingId,
  onJsonViewerStartEdit,
  setJsonViewerInlineEditingId,
  updateComponent,
}: UseCanvasNodesParams): Node[] {
  const { isRecording, onRecordHandleClick } = useFlowMode();
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const pendingNodeIds = useMemo(
    () => getPendingNodeIds(pendingPreviews),
    [pendingPreviews],
  );

  /**
   * Fix C: Cache of stable data/style references per node id.
   * When buildData/buildStyle produce a semantically-equal result, we reuse
   * the previous reference so useLocalNodes can detect "no change" via ===.
   */
  const prevNodeDataRef = useRef<
    Map<string, { data: Record<string, unknown>; style: CSSProperties | undefined }>
  >(new Map());

  const nodeCtxBase: NodeCtxBase | null = useMemo(() => {
    if (!diagram) return null;
    return {
      diagram,
      resolvedComponents,
      resolvedNodeLayouts,
      sceneBadgeByComponentId,
      compareVisualByComponentId,
      isCompareMode,
      serviceRegistry: serviceRegistry ?? {},
      allDiagrams,
      selectedNodeId,
      selectedNodeIds,
      dragTargetPanelId,
      unparentCandidatePanelId,
      panelIds,
      connectionCounts: connectionCountPerNode,
      effectiveHandleOrder,
      onReorderHandle,
      handleDrillDown,
      onRecordHandleClick,
      onPanelCollapseToggle: handlePanelCollapseToggle,
      activeFlowId,
      onPlayFlow,
      onAddEndpointToGroup,
      onNoteStartEdit,
      setNoteInlineEditingId,
      onJsonViewerStartEdit,
      setJsonViewerInlineEditingId,
      updateComponent,
      highlightedNodeIds,
      isViewingCoverage,
      journeysByComponentId: EMPTY_JOURNEYS_BY_COMPONENT_ID,
    };
  }, [
    diagram,
    resolvedComponents,
    resolvedNodeLayouts,
    sceneBadgeByComponentId,
    compareVisualByComponentId,
    isCompareMode,
    serviceRegistry,
    allDiagrams,
    selectedNodeId,
    selectedNodeIds,
    dragTargetPanelId,
    unparentCandidatePanelId,
    panelIds,
    connectionCountPerNode,
    effectiveHandleOrder,
    onReorderHandle,
    handleDrillDown,
    onRecordHandleClick,
    handlePanelCollapseToggle,
    activeFlowId,
    onPlayFlow,
    onAddEndpointToGroup,
    onNoteStartEdit,
    setNoteInlineEditingId,
    onJsonViewerStartEdit,
    setJsonViewerInlineEditingId,
    updateComponent,
    highlightedNodeIds,
    isViewingCoverage,
  ]);

  const nodeCtxPlayback = useMemo(
    () => ({
      isPlaying,
      isRecording,
      flowHighlight,
      activeStep,
      recordingInfo,
      coverage,
    }),
    [isPlaying, isRecording, flowHighlight, activeStep, recordingInfo, coverage],
  );

  return useMemo(() => {
    if (!diagram || !nodeCtxBase) return [];

    const {
      highlightedNodeIds: hIds,
      isViewingCoverage: viewingCov,
      ...ctxBaseForBuild
    } = nodeCtxBase;

    const ctx: NodeBuildContext = {
      ...ctxBaseForBuild,
      ...nodeCtxPlayback,
    };

    const collapsedPanelIds = buildCollapsedPanelIds(nodeCtxBase.resolvedComponents);
    const compareVisual = nodeCtxBase.compareVisualByComponentId;
    const isCmp = nodeCtxBase.isCompareMode ?? false;

    // Fix C: purge stale cache entries for nodes no longer visible
    const visibleIds = new Set(visibleComponents.map((c) => c.id));
    for (const cachedId of prevNodeDataRef.current.keys()) {
      if (!visibleIds.has(cachedId)) prevNodeDataRef.current.delete(cachedId);
    }

    function getParentDepth(
      comp: Component,
      comps: Record<string, Component>,
    ): number {
      let depth = 0;
      let currentId = comp.parentId;
      const visited = new Set<string>();
      while (currentId && comps[currentId] && !visited.has(currentId)) {
        visited.add(currentId);
        depth++;
        currentId = comps[currentId].parentId;
      }
      return depth;
    }

    const depthCache = new Map<string, number>();
    function getDepth(comp: Component): number {
      if (depthCache.has(comp.id)) return depthCache.get(comp.id)!;
      const d = getParentDepth(comp, nodeCtxBase.resolvedComponents);
      depthCache.set(comp.id, d);
      return d;
    }

    return [...visibleComponents]
      .sort((a, b) => {
        const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
        const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
        if (aIsGroup && !bIsGroup) return -1;
        if (!aIsGroup && bIsGroup) return 1;
        const depthA = getDepth(a);
        const depthB = getDepth(b);
        if (depthA !== depthB) return depthA - depthB;
        return 0;
      })
      .map((comp): Node => {
        const d = resolveNodeDescriptor(comp);
        const layout = nodeCtxBase.resolvedNodeLayouts[comp.id];
        const vis = computeNodeVisibility(
          comp,
          d,
          layout,
          nodeCtxBase.panelIds,
          nodeCtxBase.selectedNodeIds,
          hIds,
          collapsedPanelIds,
          viewingCov,
          nodeCtxPlayback.coverage,
          nodeCtxBase.resolvedComponents,
        );
        const style: Record<string, unknown> = {
          ...d.buildStyle?.(comp, ctx),
          ...(vis.dimmed ? { opacity: OPACITY_FLOW_PLAYBACK_NODE_DIM } : {}),
        };
        const cmpVis = compareVisual?.[comp.id];
        if (cmpVis !== undefined) {
          const baseOp = typeof style.opacity === "number" ? style.opacity : 1;
          style.opacity = baseOp * cmpVis.opacity;
        }
        const tagFilteredHidden = isNodeHiddenByTagFilter(comp);
        if (tagFilteredHidden) {
          style.opacity = OPACITY_TAG_FILTER_DIM;
          style.pointerEvents = "none";
          style.transition = "opacity 0.2s ease";
        }
        const lockedInGroup =
          isEndpointType(comp.type) &&
          comp.parentId != null &&
          isApiGroupComponent(nodeCtxBase.resolvedComponents[comp.parentId]);
        const sceneActive =
          !!diagram.activeSceneId && !!diagram.scenes?.[diagram.activeSceneId];
        const sceneLocksBase =
          sceneActive && !isComponentAddedInActiveScene(diagram, comp.id);
        const isLockedBySelfOrAncestor =
          comp.locked === true || isAncestorLocked(comp, nodeCtxBase.resolvedComponents);
        const diffOutline =
          isCmp && cmpVis !== undefined ? compareDiffOutlineClass(cmpVis) : "";
        const nodeClassNames = [
          isCmp ? "cursor-default" : "",
          isLockedBySelfOrAncestor ? "cursor-not-allowed" : "",
          pendingNodeIds.has(comp.id) ? "node-pending" : "",
          diffOutline,
        ]
          .filter(Boolean)
          .join(" ");
        // Fix C: stabilize data/style references using shallow equality so that
        // useLocalNodes can skip re-renders when nothing semantically changed.
        const newData = d.buildData(comp, ctx) as Record<string, unknown>;
        const newStyle = style as CSSProperties;
        const cached = prevNodeDataRef.current.get(comp.id);
        const stableData =
          cached && shallowEqualIgnoringFunctions(cached.data, newData)
            ? cached.data
            : newData;
        const stableStyle =
          cached && shallowEqualStyle(cached.style, newStyle)
            ? cached.style
            : newStyle;
        prevNodeDataRef.current.set(comp.id, { data: stableData, style: stableStyle });

        return {
          id: comp.id,
          type: d.rfType,
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: vis.zIndex,
          connectable: d.connectable && !isCmp && !tagFilteredHidden,
          selected: vis.isSelected,
          draggable:
            !isLockedBySelfOrAncestor &&
            (d.draggable ?? !lockedInGroup) &&
            !sceneLocksBase &&
            !isCmp &&
            !tagFilteredHidden,
          selectable:
            !isLockedBySelfOrAncestor &&
            (d.selectable ?? !lockedInGroup) &&
            !isCmp &&
            !tagFilteredHidden,
          focusable: (d.focusable ?? !lockedInGroup) && !isCmp && !tagFilteredHidden,
          className: nodeClassNames || undefined,
          ...(d.dragHandle ? { dragHandle: d.dragHandle } : {}),
          ...(vis.isChild ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          hidden: vis.isHidden,
          style: stableStyle,
          data: stableData,
        };
      });
  }, [
    diagram,
    nodeCtxBase,
    nodeCtxPlayback,
    visibleComponents,
    isNodeHiddenByTagFilter,
    pendingNodeIds,
  ]);
}
