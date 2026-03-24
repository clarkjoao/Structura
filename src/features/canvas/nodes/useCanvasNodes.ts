import { useMemo, type CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import type {
  CompareElementVisual,
  Component,
  Diagram,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import {
  isPanelComponent,
  isApiGroupComponent,
  isEndpointType,
  isComponentAddedInActiveScene,
} from "@/features/diagram";
import { resolveNodeDescriptor, type NodeBuildContext } from "./node-types";
import { useFlowMode } from "../flow/FlowModeContext";
import { buildCollapsedPanelIds, computeNodeVisibility } from "./nodeVisibility";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../flow/flowState";

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
        );
        const style: Record<string, unknown> = {
          ...d.buildStyle?.(comp, ctx),
          ...(vis.dimmed ? { opacity: 0.3 } : {}),
        };
        const cmpVis = compareVisual?.[comp.id];
        if (cmpVis !== undefined) {
          const baseOp = typeof style.opacity === "number" ? style.opacity : 1;
          style.opacity = baseOp * cmpVis.opacity;
        }
        const tagFilteredHidden = isNodeHiddenByTagFilter(comp);
        if (tagFilteredHidden) {
          style.opacity = 0.15;
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
        return {
          id: comp.id,
          type: d.rfType,
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: vis.zIndex,
          connectable: d.connectable && !isCmp && !tagFilteredHidden,
          selected: vis.isSelected,
          draggable: (d.draggable ?? !lockedInGroup) && !sceneLocksBase && !isCmp && !tagFilteredHidden,
          selectable: (d.selectable ?? !lockedInGroup) && !isCmp && !tagFilteredHidden,
          focusable: (d.focusable ?? !lockedInGroup) && !isCmp && !tagFilteredHidden,
          className: isCmp ? "cursor-default" : undefined,
          ...(vis.isChild ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          hidden: vis.isHidden,
          style: style as CSSProperties,
          data: d.buildData(comp, ctx),
        };
      });
  }, [diagram, nodeCtxBase, nodeCtxPlayback, visibleComponents, isNodeHiddenByTagFilter]);
}
