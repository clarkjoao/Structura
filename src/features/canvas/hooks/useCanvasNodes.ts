import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import type { Component, Diagram } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/registry";
import { nodeTypes as _nodeTypes, getDescriptor, type NodeBuildContext } from "../node-types";

interface UseCanvasNodesParams {
  diagram: Diagram | null | undefined;
  visibleComponents: Component[];
  panelIds: Set<string>;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  handleDrillDown: (id: string) => void;
  handlePanelCollapseToggle: (id: string) => void;
  isPlaying: boolean;
  isRecording: boolean;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  connectionCountPerNode: Record<string, { incoming: number; outgoing: number }>;
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
}

export function useCanvasNodes({
  diagram,
  visibleComponents,
  panelIds,
  selectedNodeId,
  selectedNodeIds,
  serviceRegistry,
  allDiagrams,
  handleDrillDown,
  handlePanelCollapseToggle,
  isPlaying,
  isRecording,
  onRecordHandleClick,
  dragTargetPanelId,
  unparentCandidatePanelId,
  connectionCountPerNode,
  flowHighlight,
  activeStep,
  recordingInfo,
  coverage,
}: UseCanvasNodesParams): Node[] {
  return useMemo(() => {
    if (!diagram) return [];
    const collapsedPanelIds = new Set(
      Object.values(diagram.snapshot.components)
        .filter((c) => c.type === "panel" && c.collapsed)
        .map((c) => c.id),
    );
    const ctx: NodeBuildContext = {
      diagram,
      serviceRegistry: serviceRegistry ?? {},
      allDiagrams,
      selectedNodeId,
      dragTargetPanelId,
      unparentCandidatePanelId,
      panelIds,
      connectionCounts: connectionCountPerNode,
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
      .sort((a, b) => (a.type === "panel" ? -1 : b.type === "panel" ? 1 : 0))
      .map((comp): Node => {
        const d = getDescriptor(comp.type);
        const layout = diagram.nodeLayouts.find((nl) => nl.elementId === comp.id);
        const isChild = d.canHaveParent && comp.parentId !== null && panelIds.has(comp.parentId);
        const zIndex = layout?.zIndex ?? (typeof d.zIndex === "function" ? d.zIndex(comp) : d.zIndex);
        const isHidden = comp.hidden === true || (isChild && comp.parentId !== null && collapsedPanelIds.has(comp.parentId));
        const isSelected = selectedNodeIds.has(comp.id);
        const dimWhenSelectionActive = selectedNodeIds.size > 0 && !isSelected && !isHidden;
        const style = { ...d.buildStyle?.(comp, ctx), ...(dimWhenSelectionActive ? { opacity: 0.6 } : {}) };
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
    diagram, visibleComponents, panelIds, selectedNodeId, selectedNodeIds,
    serviceRegistry, allDiagrams, handleDrillDown, isPlaying, flowHighlight,
    dragTargetPanelId, unparentCandidatePanelId, isRecording, recordingInfo,
    onRecordHandleClick, activeStep, coverage, connectionCountPerNode, handlePanelCollapseToggle,
  ]);
}
