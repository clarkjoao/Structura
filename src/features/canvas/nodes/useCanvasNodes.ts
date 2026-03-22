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
import { useRecordingMode } from "../flow/RecordingModeContext";
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
}: UseCanvasNodesParams): Node[] {
  const { isRecording, onRecordHandleClick } = useRecordingMode();
  return useMemo(() => {
    if (!diagram) return [];
    const collapsedPanelIds = buildCollapsedPanelIds(resolvedComponents);
    const ctx: NodeBuildContext = {
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
      isPlaying,
      isRecording,
      flowHighlight,
      activeStep,
      recordingInfo,
      coverage,
      handleDrillDown,
      onRecordHandleClick,
      onPanelCollapseToggle: handlePanelCollapseToggle,
      activeFlowId,
      onPlayFlow,
      onAddEndpointToGroup,
    };
    return [...visibleComponents]
      .sort((a, b) => {
        const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
        const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
        if (aIsGroup && !bIsGroup) return -1;
        if (!aIsGroup && bIsGroup) return 1;
        // Among groups, parents must come before children
        if (aIsGroup && bIsGroup) {
          if (b.parentId === a.id) return -1;
          if (a.parentId === b.id) return 1;
        }
        return 0;
      })
      .map((comp): Node => {
        const d = resolveNodeDescriptor(comp);
        const layout = resolvedNodeLayouts[comp.id];
        const vis = computeNodeVisibility(
          comp, d, layout, panelIds, selectedNodeIds, highlightedNodeIds,
          collapsedPanelIds, isViewingCoverage, coverage,
        );
        const style: Record<string, unknown> = {
          ...d.buildStyle?.(comp, ctx),
          ...(vis.dimmed ? { opacity: 0.3 } : {}),
        };
        const cmpVis = compareVisualByComponentId?.[comp.id];
        if (cmpVis !== undefined) {
          const baseOp = typeof style.opacity === "number" ? style.opacity : 1;
          style.opacity = baseOp * cmpVis.opacity;
        }
        const lockedInGroup = isEndpointType(comp.type) && comp.parentId != null
          && isApiGroupComponent(resolvedComponents[comp.parentId]);
        const sceneActive =
          !!diagram.activeSceneId && !!diagram.scenes?.[diagram.activeSceneId];
        const sceneLocksBase =
          sceneActive && !isComponentAddedInActiveScene(diagram, comp.id);
        return {
          id: comp.id,
          type: d.rfType,
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: vis.zIndex,
          connectable: d.connectable && !isCompareMode,
          selected: vis.isSelected,
          draggable: (d.draggable ?? !lockedInGroup) && !sceneLocksBase && !isCompareMode,
          selectable: (d.selectable ?? !lockedInGroup) && !isCompareMode,
          focusable: (d.focusable ?? !lockedInGroup) && !isCompareMode,
          className: isCompareMode ? "cursor-default" : undefined,
          ...(vis.isChild ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          hidden: vis.isHidden,
          style: style as CSSProperties,
          data: d.buildData(comp, ctx),
        };
      });
  }, [
    diagram,
    resolvedComponents,
    resolvedNodeLayouts,
    sceneBadgeByComponentId,
    compareVisualByComponentId,
    isCompareMode,
    visibleComponents,
    panelIds,
    selectedNodeId,
    selectedNodeIds,
    highlightedNodeIds,
    serviceRegistry, allDiagrams, handleDrillDown, isPlaying, flowHighlight,
    dragTargetPanelId, unparentCandidatePanelId, isRecording, recordingInfo,
    onRecordHandleClick, activeStep, coverage, connectionCountPerNode, effectiveHandleOrder,
    onReorderHandle, handlePanelCollapseToggle, isViewingCoverage, activeFlowId, onPlayFlow, onAddEndpointToGroup,
  ]);
}
