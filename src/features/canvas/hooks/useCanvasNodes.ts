import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import type { Component, Diagram, ServiceDefinition } from "@/features/diagram";
import { isPanelComponent } from "@/features/diagram";
import { nodeTypes as _nodeTypes, getDescriptor, type NodeBuildContext } from "../node-types";
import { useRecordingMode } from "../contexts/RecordingModeContext";

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
  flowHighlight: {
    activeNodeId: string | null;
    activeConnId: string | null;
    visitedNodeIds: Set<string>;
    participantNodeIds: Set<string>;
    participantConnIds: Set<string>;
  };
  activeStep: import("@/features/diagram").FlowStep | null;
  recordingInfo: {
    nodeSteps: Map<string, number[]>;
    edgeSteps: Map<string, number[]>;
    recordedNodeIds: Set<string>;
    recordedEdgeIds: Set<string>;
    lastNodeId: string | null;
    lastEdgeId: string | null;
    lastHandleId: string | null;
  } | null;
  coverage: { nodeFlows: Map<string, string[]>; edgeFlows: Map<string, string[]> } | null;
  isViewingCoverage: boolean;
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
}: UseCanvasNodesParams): Node[] {
  const { isRecording, onRecordHandleClick } = useRecordingMode();
  return useMemo(() => {
    if (!diagram) return [];
    const collapsedPanelIds = new Set(
      Object.values(diagram.snapshot.components)
        .filter((c) => isPanelComponent(c) && c.collapsed)
        .map((c) => c.id),
    );
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
    };
    return [...visibleComponents]
      .sort((a, b) => (isPanelComponent(a) ? -1 : isPanelComponent(b) ? 1 : 0))
      .map((comp): Node => {
        const d = getDescriptor(comp.type);
        const layout = diagram.nodeLayouts.find((nl) => nl.elementId === comp.id);
        const isChild = d.canHaveParent && comp.parentId !== null && panelIds.has(comp.parentId);
        const zIndex = layout?.zIndex ?? (typeof d.zIndex === "function" ? d.zIndex(comp) : d.zIndex);
        const isHidden = comp.hidden === true || (isChild && comp.parentId !== null && collapsedPanelIds.has(comp.parentId));
        const isSelected = selectedNodeIds.has(comp.id);
        const isHighlighted = highlightedNodeIds.has(comp.id);
        const hasFocusedNodes = selectedNodeIds.size > 0 || highlightedNodeIds.size > 0;
        const isChildOfSelectedPanel =
          isChild && comp.parentId !== null && selectedNodeIds.has(comp.parentId);
        const dimWhenSelectionActive =
          hasFocusedNodes &&
          !isSelected &&
          !isHighlighted &&
          !isHidden &&
          !isChildOfSelectedPanel;
        const dimWhenCoverage = isViewingCoverage && !!coverage && !(coverage.nodeFlows.get(comp.id)?.length);
        const style = { ...d.buildStyle?.(comp, ctx), ...((dimWhenSelectionActive || dimWhenCoverage) ? { opacity: 0.3 } : {}) };
        return {
          id: comp.id,
          type: d.rfType,
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex,
          connectable: d.connectable,
          selected: isSelected,
          ...(isChild ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          hidden: isHidden,
          style,
          data: d.buildData(comp, ctx),
        };
      });
  }, [
    diagram, visibleComponents, panelIds, selectedNodeId, selectedNodeIds, highlightedNodeIds,
    serviceRegistry, allDiagrams, handleDrillDown, isPlaying, flowHighlight,
    dragTargetPanelId, unparentCandidatePanelId, isRecording, recordingInfo,
    onRecordHandleClick, activeStep, coverage, connectionCountPerNode, effectiveHandleOrder,
    onReorderHandle, handlePanelCollapseToggle, isViewingCoverage,
  ]);
}
