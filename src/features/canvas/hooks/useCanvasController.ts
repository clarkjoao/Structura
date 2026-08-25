import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCollab } from "@/features/collaboration";
import { useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { useNavigate } from "react-router-dom";
import {
  useActiveDiagramId,
  useActiveDiagramSceneState,
  useConnections,
  useDiagramTags,
  useResolvedComponents,
  useResolvedNodeLayouts,
} from "@/features/diagram";
import type { CanvasProps } from "../canvas.types";
import { useCanvasCompareState } from "./useCanvasCompareState";
import { useCanvasFlowState } from "./useCanvasFlowState";
import { useCanvasGraphState } from "./useCanvasGraphState";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { useCanvasStore } from "./useCanvasStore";
import { useCanvasVisualState } from "./useCanvasVisualState";
import { useInteractionMode } from "./useInteractionMode";
import { useAutoLayout } from "./useAutoLayout";

export function useCanvasController(canvasProps: CanvasProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const [showScenes, setShowScenes] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);
  const {
    diagram,
    allDiagrams,
    visibleComponents,
    visibleConnections,
    serviceCatalog,
    flows,
    actions,
  } = useCanvasStore();
  const activeDiagramId = useActiveDiagramId();
  const resolvedComponents = useResolvedComponents();
  const resolvedNodeLayouts = useResolvedNodeLayouts();
  const resolvedConnections = useConnections();
  const diagramSceneState = useActiveDiagramSceneState();
  const allDiagramTags = useDiagramTags();
  const visualState = useCanvasVisualState(diagram?.id ?? null);
  const { updateSelectedNode } = useCollab();
  const compareState = useCanvasCompareState({
    diagram,
    isFlowPanelOpen: !!canvasProps.isFlowPanelOpen,
    clearCanvasSelection: visualState.clearCanvasSelection,
    t,
  });
  const resolved = useMemo(
    () =>
      activeDiagramId
        ? {
            components: resolvedComponents,
            nodeLayouts: resolvedNodeLayouts,
            connections: resolvedConnections,
          }
        : null,
    [activeDiagramId, resolvedComponents, resolvedNodeLayouts, resolvedConnections],
  );
  const { runAutoLayout, isRunning: isAutoLayoutRunning } = useAutoLayout();
  const handleAutoLayout = useCallback(() => {
    if (!diagram) return;
    const measuredNodes = reactFlowInstance.getNodes();
    runAutoLayout(
      resolvedComponents,
      Object.values(resolvedConnections),
      resolvedNodeLayouts,
      measuredNodes,
    );
  }, [
    diagram,
    runAutoLayout,
    resolvedComponents,
    resolvedConnections,
    resolvedNodeLayouts,
    reactFlowInstance,
  ]);
  const flowState = useCanvasFlowState({ flows, isCompareMode: compareState.isCompareMode });
  const activeCollabElementId = visualState.selectedEdgeId ?? visualState.selectedNodeId;
  useEffect(() => {
    updateSelectedNode(activeCollabElementId);
  }, [activeCollabElementId, updateSelectedNode]);
  const interaction = useCanvasInteraction({
    canvasProps,
    navigate,
    reactFlowInstance,
    reactFlowWrapperRef,
    visualState,
    diagram,
    allDiagrams,
    actions,
    serviceCatalog,
    compareState,
    flowState,
    showScenes,
    setShowScenes,
    setFocusTitleTrigger,
    onAutoLayout: handleAutoLayout,
  });
  const graphState = useCanvasGraphState({
    diagram,
    resolved,
    diagramSceneState,
    flows,
    // Pass selection/highlight/interaction values directly — no extra useMemo wrappers.
    selectedNodeId: visualState.selectedNodeId,
    selectedNodeIds: visualState.selectedNodeIds,
    highlightedNodeIds: visualState.highlightedNodeIds,
    dragTargetPanelId: interaction.dragTargetPanelId,
    unparentCandidatePanelId: interaction.unparentCandidatePanelId,
    isNodeHiddenByTagFilter: visualState.isNodeHiddenByTagFilter,
    setSelectedEdgeId: visualState.setSelectedEdgeId,
    setSelectedNodeIds: visualState.setSelectedNodeIds,
    setSelectedNodeId: visualState.setSelectedNodeId,
    selectedEdgeId: visualState.selectedEdgeId,
    visibleTags: visualState.visibleTags,
    setNoteInlineEditingId: visualState.setNoteInlineEditingId,
    setJsonViewerInlineEditingId: visualState.setJsonViewerInlineEditingId,
    localNodesRef: interaction.localNodesRef,
    innerOnNodesChange: interaction.innerOnNodesChange,
    visibleComponents,
    visibleConnections,
    serviceCatalog,
    allDiagrams,
    // Direct slices instead of wrapped contexts.
    compareState,
    flowState,
    isViewingCoverage: !!canvasProps.isViewingCoverage,
    onPlayFlow: canvasProps.onPlayFlow,
    handleDrillDown: interaction.handleDrillDown,
    handlePanelCollapseToggle: interaction.handlePanelCollapseToggle,
    navigateToDiagram: interaction.navigateToDiagram,
    actions,
    updateNodeInternals,
    t,
  });
  const interactionMode = useInteractionMode(diagram);

  const selectedNodes = useMemo(
    () => graphState.nodes.filter((node) => visualState.selectedNodeIds.has(node.id)),
    [graphState.nodes, visualState.selectedNodeIds],
  );
  const selectedCount = visualState.selectedNodeIds.size;
  const showElementPanel =
    (visualState.selectedNodeId || visualState.selectedEdgeId || selectedCount > 0) &&
    interactionMode.canEditCanvas &&
    visualState.noteInlineEditingId === null &&
    visualState.jsonViewerInlineEditingId === null;
  return {
    t,
    diagram,
    reactFlowWrapperRef,
    visualState,
    nodes: graphState.nodes,
    edges: graphState.edges,
    onNodesChange: graphState.onNodesChange,
    onNodeDragStop: interaction.onNodeDragStop,
    eventHandlers: interaction.eventHandlers,
    interactionMode,
    isRecording: flowState.isRecording,
    actions,
    showSearch: interaction.showSearch,
    setShowSearch: interaction.setShowSearch,
    showDiagramSidebar: interaction.showDiagramSidebar,
    setShowDiagramSidebar: interaction.setShowDiagramSidebar,
    showCommandPalette: interaction.showCommandPalette,
    setShowCommandPalette: interaction.setShowCommandPalette,
    showScenes,
    setShowScenes,
    handleSelectDiagram: interaction.handleSelectDiagram,
    handleSearchSelect: interaction.handleSearchSelect,
    focusTitleTrigger,
    isPanelOpen: interaction.isPanelOpen,
    selectedNodes,
    selectedCount,
    showElementPanel,
    onDrillUp: canvasProps.onDrillUp,
    isCompareMode: compareState.isCompareMode,
    allDiagramTags,
    handleAutoLayout,
    isAutoLayoutRunning,
  };
}
