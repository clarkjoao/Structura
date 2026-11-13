import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { useNavigate } from "react-router-dom";
import {
  useActiveDiagramId,
  useActiveDiagramVersionState,
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
import { useCanvasArrange } from "./useCanvasArrange";
import { useCollabSelectionBroadcast } from "./useCollabSelectionBroadcast";
import { useElementPanelGate } from "./useElementPanelGate";

export function useCanvasController(canvasProps: CanvasProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);
  const { diagram, allDiagrams, visibleComponents, visibleConnections, services, flows, actions } =
    useCanvasStore();
  const activeDiagramId = useActiveDiagramId();
  const resolvedComponents = useResolvedComponents();
  const resolvedNodeLayouts = useResolvedNodeLayouts();
  const resolvedConnections = useConnections();
  const diagramVersionState = useActiveDiagramVersionState();
  const allDiagramTags = useDiagramTags();
  const visualState = useCanvasVisualState(diagram?.id ?? null);
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
  const {
    arrange,
    handleAutoLayout,
    handleArrangeWithSettings,
    arrangeLabelled,
    placeTouched,
    isAutoLayoutRunning,
  } = useCanvasArrange({
    diagram,
    reactFlowInstance,
    resolvedComponents,
    resolvedConnections,
    resolvedNodeLayouts,
  });
  const flowState = useCanvasFlowState({ flows, isCompareMode: compareState.isCompareMode });
  useCollabSelectionBroadcast(visualState.selectedEdgeId, visualState.selectedNodeId);
  const interaction = useCanvasInteraction({
    canvasProps,
    navigate,
    reactFlowInstance,
    reactFlowWrapperRef,
    visualState,
    diagram,
    allDiagrams,
    actions,
    services,
    compareState,
    flowState,
    showVersions,
    setShowVersions,
    setFocusTitleTrigger,
    onAutoLayout: handleAutoLayout,
  });
  const graphState = useCanvasGraphState({
    diagram,
    resolved,
    diagramVersionState,
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
    services,
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

  const { selectedNodes, selectedCount, showElementPanel } = useElementPanelGate({
    nodes: graphState.nodes,
    visualState,
    resolvedComponents,
    canEditCanvas: interactionMode.canEditCanvas,
  });
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
    showVersions,
    setShowVersions,
    handleSelectDiagram: interaction.handleSelectDiagram,
    handleSearchSelect: interaction.handleSearchSelect,
    focusTitleTrigger,
    isPanelOpen: interaction.isPanelOpen,
    selectedNodes,
    selectedCount,
    showElementPanel,
    handlePanelCollapseToggle: interaction.handlePanelCollapseToggle,
    isCompareMode: compareState.isCompareMode,
    allDiagramTags,
    handleAutoLayout,
    handleArrangeWithSettings,
    arrange,
    placeTouched,
    arrangeLabelled,
    isAutoLayoutRunning,
  };
}
