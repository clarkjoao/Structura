import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import type { Component, Diagram, ServiceDefinition } from "@/features/diagram";
import { isPanelComponent, isApiGroupComponent, isEndpointType } from "@/features/diagram";
import { getDescriptor, type NodeBuildContext } from "./node-types";
import { useRecordingMode } from "../flow/RecordingModeContext";
import { buildCollapsedPanelIds, computeNodeVisibility } from "./nodeVisibility";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../flow/flowState";

interface UseCanvasNodesParams {
  diagram: Diagram | null | undefined;
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
}

export function useCanvasNodes({
  diagram,
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
}: UseCanvasNodesParams): Node[] {
  const { isRecording, onRecordHandleClick } = useRecordingMode();
  return useMemo(() => {
    if (!diagram) return [];
    const collapsedPanelIds = buildCollapsedPanelIds(diagram.snapshot.components);
    const ctx: NodeBuildContext = {
      diagram,
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
        const d = getDescriptor(comp.type);
        const layout = diagram.nodeLayouts[comp.id];
        const vis = computeNodeVisibility(
          comp, d, layout, panelIds, selectedNodeIds, highlightedNodeIds,
          collapsedPanelIds, isViewingCoverage, coverage,
        );
        const style = { ...d.buildStyle?.(comp, ctx), ...(vis.dimmed ? { opacity: 0.3 } : {}) };
        const lockedInGroup = isEndpointType(comp.type) && comp.parentId != null
          && isApiGroupComponent(diagram.snapshot.components[comp.parentId]);
        return {
          id: comp.id,
          type: d.rfType,
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: vis.zIndex,
          connectable: d.connectable,
          selected: vis.isSelected,
          draggable: d.draggable ?? !lockedInGroup,
          selectable: d.selectable ?? !lockedInGroup,
          focusable: d.focusable ?? !lockedInGroup,
          ...(vis.isChild ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          hidden: vis.isHidden,
          style,
          data: d.buildData(comp, ctx),
        };
      });
  }, [
    diagram, visibleComponents, panelIds, selectedNodeId, selectedNodeIds, highlightedNodeIds,
    serviceRegistry, allDiagrams, handleDrillDown, isPlaying, flowHighlight,
    dragTargetPanelId, unparentCandidatePanelId, isRecording, recordingInfo,
    onRecordHandleClick, activeStep, coverage, connectionCountPerNode, effectiveHandleOrder,
    onReorderHandle, handlePanelCollapseToggle, isViewingCoverage, activeFlowId, onPlayFlow, onAddEndpointToGroup,
  ]);
}
