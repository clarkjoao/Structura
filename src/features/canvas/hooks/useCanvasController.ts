import { useRef, useEffect, useCallback, useState, type SetStateAction } from "react";
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
import { useRecordingMode } from "../flow/RecordingModeContext";
import { useRecentDiagrams } from "../navigation/useRecentDiagrams";
import type { CanvasProps } from "../canvas.types";

export function useCanvasController({
  onOpenDiagram,
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
  const { isRecording } = useRecordingMode();
  const [showSearch, setShowSearch] = useState(false);
  const [internalDiagramSidebar, setInternalDiagramSidebar] = useState(false);
  const diagramSidebarControlled = typeof onDiagramSidebarOpenChange === "function";
  const showDiagramSidebar = diagramSidebarControlled
    ? Boolean(controlledDiagramSidebarOpen)
    : internalDiagramSidebar;
  const setShowDiagramSidebar = useCallback(
    (value: SetStateAction<boolean>) => {
      if (diagramSidebarControlled) {
        const next =
          typeof value === "function" ? value(Boolean(controlledDiagramSidebarOpen)) : value;
        onDiagramSidebarOpenChange?.(next);
      } else {
        setInternalDiagramSidebar(value);
      }
    },
    [controlledDiagramSidebarOpen, diagramSidebarControlled, onDiagramSidebarOpenChange],
  );
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);

  const { recordOpened } = useRecentDiagrams();

  const { diagram, allDiagrams, visibleComponents, visibleConnections, serviceRegistry, flows, actions } =
    useCanvasStore();
  const visualState = useCanvasVisualState();
  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, diagram });
  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStepId } = useFlowState({
    flows,
  });

  const { handleDrillDown, handlePanelCollapseToggle } = useCanvasDrillHandlers({
    diagram,
    allDiagrams,
    updateComponent: actions.updateComponent,
    openDiagram: actions.openDiagram,
    navigate,
    onOpenDiagram,
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
    visibleComponents,
    panelIds,
    selectedNodeId: visualState.selectedNodeId,
    selectedNodeIds: visualState.selectedNodeIds,
    highlightedNodeIds: visualState.highlightedNodeIds,
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
    isViewingCoverage: !!isViewingCoverage,
    activeFlowId: activeFlow?.id ?? null,
    onPlayFlow,
    onAddEndpointToGroup: handleAddEndpointToGroup,
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
  );

  const edges = useCanvasEdges({
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId: visualState.selectedEdgeId,
    isPlaying,
    activeStep,
    flowHighlight,
    recordingInfo,
    coverage,
  });

  useConnectionInternalsSync(connectionCountPerNode, updateNodeInternals);

  const handleRequestFocusTitle = useCallback(() => {
    setFocusTitleTrigger((x) => x + 1);
  }, []);

  const eventHandlers = useCanvasEventHandlers({
    visualState,
    isPlaying,
    isFlowPanelOpen: !!isFlowPanelOpen,
    updateViewport: actions.updateViewport,
    addConnection: actions.addConnection,
    screenToFlowPosition: (pos) => reactFlowInstance.screenToFlowPosition(pos),
    onRequestFocusTitle: handleRequestFocusTitle,
  });

  const isPanelOpen = !!(visualState.selectedNodeId || visualState.selectedEdgeId) && !isRecording;
  useEffect(() => {
    if (!diagram) return;
    recordOpened(diagram.id, diagram.name);
  }, [diagram, recordOpened]);

  const handleSelectDiagram = useCallback(
    (id: string) => {
      const target = allDiagrams[id];
      if (!target) return;
      if (id === diagram?.id) {
        setShowDiagramSidebar(false);
        setShowCommandPalette(false);
        return;
      }
      if (onOpenDiagram) {
        onOpenDiagram(id);
      } else {
        actions.openDiagram(id);
        navigate(`/model/${id}`);
      }
    },
    [
      actions,
      allDiagrams,
      diagram?.id,
      navigate,
      onOpenDiagram,
      setShowCommandPalette,
      setShowDiagramSidebar,
    ],
  );

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
    [reactFlowInstance, visualState],
  );

  useCanvasKeyboard({
    diagram,
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
    isCommandPaletteOpen: showCommandPalette,
    onToggleDiagramSidebar: () => setShowDiagramSidebar((v) => !v),
    onOpenCommandPalette: () => {
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

  useEffect(() => {
    if (isFlowPanelOpen) visualState.clearCanvasSelection();
  }, [isFlowPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNodes = nodes.filter((n) => visualState.selectedNodeIds.has(n.id));
  const selectedCount = visualState.selectedNodeIds.size;
  const showElementPanel =
    (visualState.selectedNodeId || visualState.selectedEdgeId || selectedCount > 0) && !isRecording;

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
    handleSelectDiagram,
    handleSearchSelect,
    focusTitleTrigger,
    isPanelOpen,
    selectedNodes,
    selectedCount,
    showElementPanel,
    onDrillUp,
  };
}
