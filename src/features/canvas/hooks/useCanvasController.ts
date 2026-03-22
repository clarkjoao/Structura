import { useRef, useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useReactFlow, useUpdateNodeInternals, type Node } from "@xyflow/react";
import { useNavigate } from "react-router-dom";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import { useNodeDragParenting } from "./useNodeDragParenting";
import { useFlowState } from "../flow/useFlowState";
import { useCanvasNodes } from "../nodes/useCanvasNodes";
import { useCanvasEdges } from "../edges/useCanvasEdges";
import { useCanvasStore } from "./useCanvasStore";
import { useCanvasVisualState } from "./useCanvasVisualState";
import { useCanvasConnectionDerivations } from "../edges/useCanvasConnectionDerivations";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";
import { useCanvasDrillHandlers } from "./useCanvasDrillHandlers";
import { useCanvasHandleReorder } from "../edges/useCanvasHandleReorder";
import { useCanvasEffects } from "./useCanvasEffects";
import { useLocalNodes } from "./useLocalNodes";
import { useConnectionInternalsSync } from "./useConnectionInternalsSync";
import { useFlowMode } from "../flow/FlowModeContext";
import { useCanvasCompareMode } from "./useCanvasCompareMode";
import { useCanvasDiagramNavigation } from "./useCanvasDiagramNavigation";
import { useCanvasCompareModeEffects } from "./useCanvasCompareModeEffects";
import type { CanvasProps } from "../canvas.types";
import { resolveCanvasSnapshot } from "@/features/diagram";

export function useCanvasController({
  onOpenDiagram,
  onDrillDownToDiagram,
  onDrillUp,
  isViewingCoverage,
  isFlowPanelOpen,
  onPlayFlow,
  diagramSidebarOpen: controlledDiagramSidebarOpen,
  onDiagramSidebarOpenChange,
}: CanvasProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const { isRecording } = useFlowMode();
  const [showScenes, setShowScenes] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);

  const { diagram, allDiagrams, visibleComponents, visibleConnections, serviceRegistry, flows, actions } =
    useCanvasStore();
  const visualState = useCanvasVisualState(diagram?.id ?? null);

  const {
    isCompareMode,
    compareVisualByComponentId,
    compareConnectionOpacity,
    sceneBadgeByComponentId,
  } = useCanvasCompareMode(diagram);

  const resolved = useMemo(
    () => (diagram ? resolveCanvasSnapshot(diagram) : null),
    [diagram],
  );

  const allDiagramTags = useMemo(() => {
    if (!resolved?.components) {
      return [];
    }
    const tags = new Set<string>();
    Object.values(resolved.components).forEach((component) => {
      component.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [resolved?.components]);

  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStepId } = useFlowState({
    flows,
    isCompareMode,
  });

  const isPlayingEffective = isCompareMode ? false : isPlaying;
  const diagramNavLocked = isRecording || isPlaying || isCompareMode;

  const {
    showSearch,
    setShowSearch,
    showDiagramSidebar,
    setShowDiagramSidebar,
    showCommandPalette,
    setShowCommandPalette,
    handleSelectDiagram,
  } = useCanvasDiagramNavigation({
    diagram,
    allDiagrams,
    diagramNavLocked,
    actions,
    onOpenDiagram,
    diagramSidebarOpen: controlledDiagramSidebarOpen,
    onDiagramSidebarOpenChange,
    navigate,
    setShowScenes,
  });

  useCanvasCompareModeEffects({
    isCompareMode,
    isFlowPanelOpen: !!isFlowPanelOpen,
    clearCanvasSelection: visualState.clearCanvasSelection,
    t,
  });

  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, diagram });

  const { handleDrillDown, handlePanelCollapseToggle } = useCanvasDrillHandlers({
    diagram,
    allDiagrams,
    updateComponent: actions.updateComponent,
    openDiagram: actions.openDiagram,
    navigate,
    onOpenDiagram,
    onDrillDownToDiagram,
  });

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

  const localNodesRef = useRef<Node[]>([]);

  const { dragTargetPanelId, unparentCandidatePanelId, onNodesChange: innerOnNodesChange, onNodeDragStop } =
    useNodeDragParenting({
      diagram,
      nodes: localNodesRef.current,
      updateNodeLayout: actions.updateNodeLayout,
      setParent: actions.setParent,
    });

  const storeNodes = useCanvasNodes({
    diagram,
    resolvedComponents: resolved?.components ?? {},
    resolvedNodeLayouts: resolved?.nodeLayouts ?? {},
    sceneBadgeByComponentId,
    compareVisualByComponentId,
    isCompareMode,
    visibleComponents,
    panelIds,
    selectedNodeId: visualState.selectedNodeId,
    selectedNodeIds: visualState.selectedNodeIds,
    highlightedNodeIds: visualState.highlightedNodeIds,
    serviceRegistry,
    allDiagrams,
    handleDrillDown,
    handlePanelCollapseToggle,
    isPlaying: isPlayingEffective,
    dragTargetPanelId,
    unparentCandidatePanelId,
    connectionCountPerNode,
    effectiveHandleOrder,
    onReorderHandle,
    flowHighlight,
    activeStep,
    recordingInfo,
    coverage,
    isViewingCoverage: !!isViewingCoverage,
    activeFlowId: activeFlow?.id ?? null,
    onPlayFlow,
    onAddEndpointToGroup: handleAddEndpointToGroup,
    isNodeHiddenByTagFilter: visualState.isNodeHiddenByTagFilter,
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
    isPlaying: isPlayingEffective,
    isCompareMode,
    compareConnectionOpacity,
    activeStep,
    flowHighlight,
    recordingInfo,
    coverage,
    hiddenTags: visualState.hiddenTags,
  });

  useConnectionInternalsSync(connectionCountPerNode, updateNodeInternals);

  const handleRequestFocusTitle = useCallback(() => {
    setFocusTitleTrigger((x) => x + 1);
  }, []);

  const eventHandlers = useCanvasEventHandlers({
    visualState,
    isPlaying,
    isCompareMode,
    isFlowPanelOpen: !!isFlowPanelOpen,
    updateViewport: actions.updateViewport,
    addConnection: actions.addConnection,
    screenToFlowPosition: (pos) => reactFlowInstance.screenToFlowPosition(pos),
    onRequestFocusTitle: handleRequestFocusTitle,
  });

  const isPanelOpen =
    !!(visualState.selectedNodeId || visualState.selectedEdgeId) && !isRecording && !isCompareMode;

  const handleSearchSelect = useCallback(
    (componentId: string) => {
      setShowSearch(false);
      visualState.setSelectedNodeId(componentId);
      visualState.setSelectedNodeIds(new Set([componentId]));
      visualState.setSelectedEdgeId(null);
      void reactFlowInstance.fitView({
        nodes: [{ id: componentId }],
        duration: 400,
        padding: 0.4,
        maxZoom: 1,
      });
    },
    [reactFlowInstance, setShowSearch, visualState],
  );

  useCanvasKeyboard({
    diagram,
    setCompareScene: actions.setCompareScene,
    isCompareMode,
    serviceRegistry,
    selectedNodeId: visualState.selectedNodeId,
    selectedEdgeId: visualState.selectedEdgeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    setSelectedNodeId: visualState.setSelectedNodeId,
    setSelectedNodeIds: visualState.setSelectedNodeIds,
    setSelectedEdgeId: visualState.setSelectedEdgeId,
    setContextMenu: () => visualState.setContextMenu(null),
    undo: actions.undo,
    redo: actions.redo,
    removeComponent: actions.removeComponent,
    removeConnection: actions.removeConnection,
    groupNodes: actions.groupNodes,
    ungroupNodes: actions.ungroupNodes,
    setParent: actions.setParent,
    updateNodeLayout: actions.updateNodeLayout,
    copyToClipboard: actions.copyToClipboard,
    pasteFromClipboard: actions.pasteFromClipboard,
    clearClipboard: actions.clearClipboard,
    addComponent: actions.addComponent,
    isPanelOpen,
    isFlowPanelOpen: !!isFlowPanelOpen,
    isPlaying,
    isSearchOpen: showSearch,
    onOpenSearch: () => {
      setShowCommandPalette(false);
      setShowSearch(true);
    },
    isScenesDrawerOpen: showScenes,
    onCloseScenesDrawer: () => setShowScenes(false),
    isCommandPaletteOpen: showCommandPalette,
    onToggleDiagramSidebar: () => {
      if (diagramNavLocked) return;
      setShowDiagramSidebar((v) => !v);
    },
    onOpenCommandPalette: () => {
      if (diagramNavLocked) return;
      setShowSearch(false);
      setShowCommandPalette(true);
    },
  });

  useCanvasEffects({
    diagram,
    reactFlowInstance,
    isPlaying,
    activeFlow,
    currentStepId,
    onClearSelection: visualState.clearCanvasSelection,
  });

  const selectedNodes = nodes.filter((n) => visualState.selectedNodeIds.has(n.id));
  const selectedCount = visualState.selectedNodeIds.size;
  const showElementPanel =
    (visualState.selectedNodeId || visualState.selectedEdgeId || selectedCount > 0) &&
    !isRecording &&
    !isCompareMode;

  return {
    t,
    diagram,
    reactFlowWrapperRef,
    visualState,
    nodes,
    edges,
    onNodesChange,
    onNodeDragStop,
    eventHandlers,
    isRecording,
    actions,
    showSearch,
    setShowSearch,
    showDiagramSidebar,
    setShowDiagramSidebar,
    showCommandPalette,
    setShowCommandPalette,
    showScenes,
    setShowScenes,
    handleSelectDiagram,
    handleSearchSelect,
    focusTitleTrigger,
    isPanelOpen,
    selectedNodes,
    selectedCount,
    showElementPanel,
    onDrillUp,
    isCompareMode,
    allDiagramTags,
  };
}
