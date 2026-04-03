import { useMemo, type CSSProperties } from "react";
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
import { useFlowMode } from "@/features/flows";
import { buildCollapsedPanelIds, computeNodeVisibility } from "./nodeVisibility";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "@/features/flows";
import { OPACITY_FLOW_PLAYBACK_NODE_DIM, OPACITY_TAG_FILTER_DIM } from "../canvas.constants";

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

    return [...visibleComponents]
      .sort((a, b) => {
        const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
        const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
        if (aIsGroup && !bIsGroup) return -1;
        if (!aIsGroup && bIsGroup) return 1;
        if (aIsGroup && bIsGroup) {
          if (b.parentId === a.id) return -1;
          if (a.parentId === b.id) return 1;
        }
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
        const nodeClassNames = [
          isCmp ? "cursor-default" : "",
          isLockedBySelfOrAncestor ? "cursor-not-allowed" : "",
        ]
          .filter(Boolean)
          .join(" ");
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
          style: style as CSSProperties,
          data: d.buildData(comp, ctx),
        };
      });
  }, [diagram, nodeCtxBase, nodeCtxPlayback, visibleComponents, isNodeHiddenByTagFilter]);
}
