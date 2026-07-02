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
import type { NodeSelectionState } from "@/features/canvas/hooks/useCanvasVisualState";
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
    serviceRegistry,
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
    runAutoLayout(resolvedComponents, Object.values(resolvedConnections), resolvedNodeLayouts);
  }, [diagram, runAutoLayout, resolvedComponents, resolvedConnections, resolvedNodeLayouts]);
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
    serviceRegistry,
    compareState,
    flowState,
    showScenes,
    setShowScenes,
    setFocusTitleTrigger,
    onAutoLayout: handleAutoLayout,
  });
  const flowContext = useMemo(
    () => ({
      flowState,
      isViewingCoverage: !!canvasProps.isViewingCoverage,
      onPlayFlow: canvasProps.onPlayFlow,
    }),
    [canvasProps.isViewingCoverage, canvasProps.onPlayFlow, flowState],
  );
  const compareContext = useMemo(
    () => ({
      compareState,
    }),
    [compareState],
  );
  const nodeSelectionState = useMemo(
    (): NodeSelectionState => ({
      selectedNodeId: visualState.selectedNodeId,
      selectedNodeIds: visualState.selectedNodeIds,
      highlightedNodeIds: visualState.highlightedNodeIds,
      dragTargetPanelId: interaction.dragTargetPanelId,
      unparentCandidatePanelId: interaction.unparentCandidatePanelId,
      isNodeHiddenByTagFilter: visualState.isNodeHiddenByTagFilter,
    }),
    [
      visualState.selectedNodeId,
      visualState.selectedNodeIds,
      visualState.highlightedNodeIds,
      interaction.dragTargetPanelId,
      interaction.unparentCandidatePanelId,
      visualState.isNodeHiddenByTagFilter,
    ],
  );
  const visualContext = useMemo(
    () => ({
      visualState,
      dragTargetPanelId: interaction.dragTargetPanelId,
      unparentCandidatePanelId: interaction.unparentCandidatePanelId,
    }),
    [interaction.dragTargetPanelId, interaction.unparentCandidatePanelId, visualState],
  );
  const selectionCallbacks = useMemo(
    () => ({
      setSelectedEdgeId: visualState.setSelectedEdgeId,
      setContextMenu: (_: null) => visualState.setContextMenu(null),
      setSelectedNodeIds: (ids: Set<string>) => visualState.setSelectedNodeIds(ids),
      setSelectedNodeId: visualState.setSelectedNodeId,
    }),
    [visualState],
  );
  const graphState = useCanvasGraphState({
    diagram,
    resolved,
    diagramSceneState,
    flows,
    nodeSelectionState,
    selectionCallbacks,
    selectedEdgeId: visualState.selectedEdgeId,
    visibleTags: visualState.visibleTags,
    setNoteInlineEditingId: visualState.setNoteInlineEditingId,
    setJsonViewerInlineEditingId: visualState.setJsonViewerInlineEditingId,
    localNodesRef: interaction.localNodesRef,
    innerOnNodesChange: interaction.innerOnNodesChange,
    visibleComponents,
    visibleConnections,
    serviceRegistry,
    allDiagrams,
    compareContext,
    flowContext,
    handleDrillDown: interaction.handleDrillDown,
    handlePanelCollapseToggle: interaction.handlePanelCollapseToggle,
    navigateToDiagram: interaction.navigateToDiagram,
    actions,
    updateNodeInternals,
    t,
  });
  const interactionMode = useInteractionMode(diagram);

  const selectedNodes = useMemo(
    () => graphState.nodes.filter((node) => visualContext.visualState.selectedNodeIds.has(node.id)),
    [graphState.nodes, visualContext.visualState.selectedNodeIds],
  );
  const selectedCount = visualContext.visualState.selectedNodeIds.size;
  const showElementPanel =
    (visualContext.visualState.selectedNodeId ||
      visualContext.visualState.selectedEdgeId ||
      selectedCount > 0) &&
    interactionMode.canEditCanvas &&
    visualContext.visualState.noteInlineEditingId === null &&
    visualContext.visualState.jsonViewerInlineEditingId === null;
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
