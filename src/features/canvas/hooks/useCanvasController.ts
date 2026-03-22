import { useRef, useEffect, useCallback, useState, useMemo, type SetStateAction } from "react";
import { toast } from "sonner";
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
import {
  buildCompareComponentVisuals,
  buildCompareConnectionVisuals,
  isDiagramCompareMode,
  resolveCanvasSnapshot,
} from "@/features/diagram";

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
  const [showScenes, setShowScenes] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);

  const { recordOpened } = useRecentDiagrams();

  const { diagram, allDiagrams, visibleComponents, visibleConnections, serviceRegistry, flows, actions } =
    useCanvasStore();
  const visualState = useCanvasVisualState();

  const isCompareMode = useMemo(() => isDiagramCompareMode(diagram), [diagram]);

  const resolved = useMemo(
    () => (diagram ? resolveCanvasSnapshot(diagram) : null),
    [diagram],
  );

  const compareVisualByComponentId = useMemo(() => {
    if (!diagram || !isCompareMode) return undefined;
    const a = diagram.activeSceneId!;
    const b = diagram.compareSceneId!;
    return buildCompareComponentVisuals(diagram, a, b);
  }, [diagram, isCompareMode]);

  const compareConnectionOpacity = useMemo(() => {
    if (!diagram || !isCompareMode) return undefined;
    const a = diagram.activeSceneId!;
    const b = diagram.compareSceneId!;
    const v = buildCompareConnectionVisuals(diagram, a, b);
    return Object.fromEntries(Object.entries(v).map(([id, cv]) => [id, cv.opacity]));
  }, [diagram, isCompareMode]);

  const sceneBadgeByComponentId = useMemo(() => {
    if (!diagram?.activeSceneId || !diagram.scenes?.[diagram.activeSceneId]) return {};
    const sc = diagram.scenes[diagram.activeSceneId];
    return Object.fromEntries(
      Object.keys(sc.addedComponents).map((id) => [id, { name: sc.name, color: sc.color }]),
    );
  }, [diagram]);
  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, diagram });
  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStepId } = useFlowState({
    flows,
  });

  const isPlayingEffective = isCompareMode ? false : isPlaying;
  const diagramNavLocked = isRecording || isPlaying;

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
    isPlaying: isPlayingEffective,
    isCompareMode,
    compareConnectionOpacity,
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
    isCompareMode,
    isFlowPanelOpen: !!isFlowPanelOpen,
    updateViewport: actions.updateViewport,
    addConnection: actions.addConnection,
    screenToFlowPosition: (pos) => reactFlowInstance.screenToFlowPosition(pos),
    onRequestFocusTitle: handleRequestFocusTitle,
  });

  const isPanelOpen =
    !!(visualState.selectedNodeId || visualState.selectedEdgeId) && !isRecording && !isCompareMode;
  useEffect(() => {
    if (!diagram) return;
    recordOpened(diagram.id);
  }, [diagram, recordOpened]);

  const handleSelectDiagram = useCallback(
    (id: string) => {
      if (diagramNavLocked) return;
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
      diagramNavLocked,
    ],
  );

  useEffect(() => {
    if (!diagramNavLocked) return;
    setShowCommandPalette(false);
    setShowSearch(false);
    setShowDiagramSidebar(false);
    setShowScenes(false);
  }, [diagramNavLocked, setShowDiagramSidebar]);

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

  useEffect(() => {
    if (isFlowPanelOpen) visualState.clearCanvasSelection();
  }, [isFlowPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNodes = nodes.filter((n) => visualState.selectedNodeIds.has(n.id));
  const selectedCount = visualState.selectedNodeIds.size;
  const showElementPanel =
    (visualState.selectedNodeId || visualState.selectedEdgeId || selectedCount > 0) &&
    !isRecording &&
    !isCompareMode;

  const compareModeEnteredRef = useRef(false);
  useEffect(() => {
    if (!isCompareMode) {
      compareModeEnteredRef.current = false;
      return;
    }
    if (compareModeEnteredRef.current) return;
    compareModeEnteredRef.current = true;
    try {
      const k = "structura:compareTooltipSeen";
      if (typeof localStorage !== "undefined" && !localStorage.getItem(k)) {
        localStorage.setItem(k, "1");
        toast.message(t("scenes.compareModeTooltip"));
      }
    } catch {
      /* ignore */
    }
  }, [isCompareMode, t]);

  const prevCompareRef = useRef(false);
  useEffect(() => {
    if (isCompareMode && !prevCompareRef.current) {
      visualState.clearCanvasSelection();
    }
    prevCompareRef.current = isCompareMode;
  }, [isCompareMode, visualState]);

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
  };
}
