import { useCallback, type MutableRefObject } from "react";
import type { TFunction } from "i18next";
import type { Node } from "@xyflow/react";
import type { Component, Connection, Diagram, ServiceDefinition } from "@/features/diagram";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasConnectionDerivations } from "../edges/useCanvasConnectionDerivations";
import { useCanvasNodes } from "../nodes/useCanvasNodes";
import { useCanvasEdges } from "../edges/useCanvasEdges";
import { useCanvasHandleReorder } from "../edges/useCanvasHandleReorder";
import { useLocalNodes } from "./useLocalNodes";
import { useConnectionInternalsSync } from "./useConnectionInternalsSync";

type FlowSlice = ReturnType<typeof import("./useCanvasFlowState").useCanvasFlowState>;
type CompareSlice = ReturnType<typeof import("./useCanvasCompareState").useCanvasCompareState>;
type DiagramActions = ReturnType<typeof import("@/features/diagram").useDiagramActions>;
type ResolvedSnapshot = ReturnType<typeof import("@/features/diagram").resolveCanvasSnapshot>;
type NodeDragParenting = ReturnType<typeof import("./useNodeDragParenting").useNodeDragParenting>;

export interface UseCanvasGraphStateParams {
  diagram: Diagram | null | undefined;
  resolved: ResolvedSnapshot | null;
  visualState: CanvasVisualState;
  localNodesRef: MutableRefObject<Node[]>;
  innerOnNodesChange: NodeDragParenting["onNodesChange"];
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  visibleComponents: Component[];
  visibleConnections: Connection[];
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  compareState: CompareSlice;
  flowState: FlowSlice;
  handleDrillDown: (elementId: string) => void;
  handlePanelCollapseToggle: (panelId: string) => void;
  actions: DiagramActions;
  isViewingCoverage: boolean;
  onPlayFlow?: (flowId: string) => void;
  updateNodeInternals: (nodeIds: string[]) => void;
  t: TFunction;
  onNoteStartEdit?: (noteId: string) => void;
}

/** Derives React Flow nodes and edges from the diagram store and canvas-specific layout state. */
export function useCanvasGraphState(params: UseCanvasGraphStateParams) {
  const {
    diagram,
    resolved,
    visualState,
    localNodesRef,
    innerOnNodesChange,
    dragTargetPanelId,
    unparentCandidatePanelId,
    visibleComponents,
    visibleConnections,
    serviceRegistry,
    allDiagrams,
    compareState,
    flowState,
    handleDrillDown,
    handlePanelCollapseToggle,
    actions,
    isViewingCoverage,
    onPlayFlow,
    updateNodeInternals,
    t,
    onNoteStartEdit,
  } = params;

  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, diagram });

  const handleAddEndpointToGroup = useCallback(
    (groupId: string) => {
      actions.addComponent("endpoint", t("canvas.newEndpoint"), groupId);
    },
    [actions, t],
  );

  const { onReorderHandle } = useCanvasHandleReorder({
    effectiveHandleOrder,
    updateHandleOrder: actions.updateHandleOrder,
  });

  const storeNodes = useCanvasNodes({
    diagram,
    resolvedComponents: resolved?.components ?? {},
    resolvedNodeLayouts: resolved?.nodeLayouts ?? {},
    sceneBadgeByComponentId: compareState.sceneBadgeByComponentId,
    compareVisualByComponentId: compareState.compareVisualByComponentId,
    isCompareMode: compareState.isCompareMode,
    visibleComponents,
    panelIds,
    selectedNodeId: visualState.selectedNodeId,
    selectedNodeIds: visualState.selectedNodeIds,
    highlightedNodeIds: visualState.highlightedNodeIds,
    serviceRegistry,
    allDiagrams,
    handleDrillDown,
    handlePanelCollapseToggle,
    isPlaying: flowState.isPlayingEffective,
    dragTargetPanelId,
    unparentCandidatePanelId,
    connectionCountPerNode,
    effectiveHandleOrder,
    onReorderHandle,
    flowHighlight: flowState.flowHighlight,
    activeStep: flowState.activeStep,
    recordingInfo: flowState.recordingInfo,
    coverage: flowState.coverage,
    isViewingCoverage,
    activeFlowId: flowState.activeFlow?.id ?? null,
    onPlayFlow,
    onAddEndpointToGroup: handleAddEndpointToGroup,
    isNodeHiddenByTagFilter: visualState.isNodeHiddenByTagFilter,
    onNoteStartEdit,
    setNoteInlineEditingId: visualState.setNoteInlineEditingId,
    updateComponent: actions.updateComponent,
  });

  const onSelectionFromChanges = useCallback(
    (selectedIds: string[]) => {
      if (selectedIds.length === 0) return;
      visualState.setSelectedEdgeId(null);
      visualState.setContextMenu(null);
      visualState.setSelectedNodeIds(new Set(selectedIds));
      visualState.setSelectedNodeId(selectedIds[0] ?? null);
    },
    [visualState],
  );

  const { nodes, onNodesChange } = useLocalNodes(
    storeNodes,
    innerOnNodesChange,
    localNodesRef,
    onSelectionFromChanges,
    diagram,
  );

  const edges = useCanvasEdges({
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId: visualState.selectedEdgeId,
    isPlaying: flowState.isPlayingEffective,
    isCompareMode: compareState.isCompareMode,
    compareConnectionOpacity: compareState.compareConnectionOpacity,
    activeStep: flowState.activeStep,
    flowHighlight: flowState.flowHighlight,
    recordingInfo: flowState.recordingInfo,
    coverage: flowState.coverage,
    visibleTags: visualState.visibleTags,
  });

  useConnectionInternalsSync(connectionCountPerNode, updateNodeInternals);

  return {
    nodes,
    edges,
    onNodesChange,
    effectiveHandleOrder,
    panelIds,
    edgeHandleAssignments,
  };
}
