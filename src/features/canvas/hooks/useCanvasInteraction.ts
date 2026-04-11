import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Node, ReactFlowInstance } from "@xyflow/react";
import type { NavigateFunction } from "react-router-dom";
import {
  flushDiagramStoreToLocalStorageNow,
  type Diagram,
  type ServiceDefinition,
} from "@/features/diagram";
import type { CanvasProps } from "../canvas.types";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasDiagramNavigation } from "./useCanvasDiagramNavigation";
import { useCanvasDrillHandlers } from "./useCanvasDrillHandlers";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import { useCanvasEffects } from "./useCanvasEffects";
import { useNodeDragParenting } from "./useNodeDragParenting";
import { forceSaveToConnectedFolder } from "@/infrastructure/persistence";

type FlowSlice = ReturnType<typeof import("./useCanvasFlowState").useCanvasFlowState>;
type CompareSlice = ReturnType<typeof import("./useCanvasCompareState").useCanvasCompareState>;
type DiagramActions = ReturnType<typeof import("@/features/diagram").useDiagramActions>;

export interface UseCanvasInteractionParams {
  canvasProps: CanvasProps;
  navigate: NavigateFunction;
  reactFlowInstance: ReactFlowInstance;
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
  visualState: CanvasVisualState;
  diagram: Diagram | null | undefined;
  allDiagrams: Record<string, Diagram>;
  actions: DiagramActions;
  serviceRegistry: Record<string, ServiceDefinition>;
  compareState: CompareSlice;
  flowState: FlowSlice;
  showScenes: boolean;
  setShowScenes: Dispatch<SetStateAction<boolean>>;
  setFocusTitleTrigger: Dispatch<SetStateAction<number>>;
}

export interface UseCanvasInteractionResult {
  handleDrillDown: (elementId: string) => void;
  handlePanelCollapseToggle: (panelId: string) => void;
  localNodesRef: MutableRefObject<Node[]>;
  innerOnNodesChange: ReturnType<typeof useNodeDragParenting>["onNodesChange"];
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  onNodeDragStop: ReturnType<typeof useNodeDragParenting>["onNodeDragStop"];
  eventHandlers: ReturnType<typeof useCanvasEventHandlers>;
  isPanelOpen: boolean;
  showSearch: boolean;
  setShowSearch: (value: boolean) => void;
  showDiagramSidebar: boolean;
  setShowDiagramSidebar: Dispatch<SetStateAction<boolean>>;
  showCommandPalette: boolean;
  setShowCommandPalette: (value: boolean) => void;
  handleSelectDiagram: (id: string) => void;
  handleSearchSelect: (componentId: string) => void;
}

/** Wires diagram navigation, drill actions, pointer/connection handlers, keyboard shortcuts, and playback side effects. */
export function useCanvasInteraction(params: UseCanvasInteractionParams): UseCanvasInteractionResult {
  const {
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
  } = params;

  const { t } = useTranslation();

  const forceSaveToFolder = useCallback(async () => {
    const fsResult = await forceSaveToConnectedFolder();
    const localOk = await flushDiagramStoreToLocalStorageNow();

    if (fsResult === "ok") {
      toast.success(t("filesystem.savedSuccess"));
    } else if (fsResult === "no_folder") {
      toast.info(t("filesystem.noFolderConnected"));
    } else {
      toast.error(t("filesystem.saveError"));
    }

    if (localOk) {
      toast.success(t("localStorage.savedSuccess"));
    }
  }, [t]);

  const diagramNavLocked = flowState.isRecording || flowState.isPlaying || compareState.isCompareMode;

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
    onOpenDiagram: canvasProps.onOpenDiagram,
    diagramSidebarOpen: canvasProps.diagramSidebarOpen,
    onDiagramSidebarOpenChange: canvasProps.onDiagramSidebarOpenChange,
    navigate,
    setShowScenes,
  });

  const { handleDrillDown, handlePanelCollapseToggle } = useCanvasDrillHandlers({
    diagram,
    allDiagrams,
    updateComponent: actions.updateComponent,
    openDiagram: actions.openDiagram,
    navigate,
    onOpenDiagram: canvasProps.onOpenDiagram,
    onDrillDownToDiagram: canvasProps.onDrillDownToDiagram,
  });

  const localNodesRef = useRef<Node[]>([]);
  const { dragTargetPanelId, unparentCandidatePanelId, onNodesChange: innerOnNodesChange, onNodeDragStop } =
    useNodeDragParenting({
      diagram,
      nodes: localNodesRef.current,
      updateNodeLayout: actions.updateNodeLayout,
      commitNodeDrag: actions.commitNodeDrag,
      batchCommitNodeDrag: actions.batchCommitNodeDrag,
    });

  const handleRequestFocusTitle = useCallback(() => {
    setFocusTitleTrigger((value) => value + 1);
  }, [setFocusTitleTrigger]);

  useEffect(() => {
    setFocusTitleTrigger(0);
  }, [visualState.selectedNodeId, visualState.selectedEdgeId, setFocusTitleTrigger]);

  const eventHandlers = useCanvasEventHandlers({
    visualState,
    isPlaying: flowState.isPlaying,
    isCompareMode: compareState.isCompareMode,
    isFlowPanelOpen: !!canvasProps.isFlowPanelOpen,
    updateViewport: actions.updateViewport,
    addConnection: actions.addConnection,
    screenToFlowPosition: (pos) => reactFlowInstance.screenToFlowPosition(pos),
    onRequestFocusTitle: handleRequestFocusTitle,
  });

  const isPanelOpen =
    !!(visualState.selectedNodeId || visualState.selectedEdgeId) &&
    !flowState.isRecording &&
    !compareState.isCompareMode &&
    visualState.noteInlineEditingId === null &&
    visualState.jsonViewerInlineEditingId === null;

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
    isCompareMode: compareState.isCompareMode,
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
    importDrawioResult: actions.importDrawioResult,
    clearClipboard: actions.clearClipboard,
    addComponent: actions.addComponent,
    isPanelOpen,
    isFlowPanelOpen: !!canvasProps.isFlowPanelOpen,
    isPlaying: flowState.isPlaying,
    isRecording: flowState.isRecording,
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
      setShowDiagramSidebar((value) => !value);
    },
    onOpenCommandPalette: () => {
      if (diagramNavLocked) return;
      setShowSearch(false);
      setShowCommandPalette(true);
    },
    onOpenQuickInsert: ({ screenPos, flowPos }) => {
      if (diagramNavLocked || !!canvasProps.isFlowPanelOpen) return;
      visualState.setQuickInsert({ screenPos, flowPos });
    },
    forceSaveToFolder,
  });

  useCanvasEffects({
    diagram,
    reactFlowInstance,
    isPlaying: flowState.isPlaying,
    activeFlow: flowState.activeFlow,
    currentStepId: flowState.currentStepId,
    onClearSelection: visualState.clearCanvasSelection,
  });

  return {
    handleDrillDown,
    handlePanelCollapseToggle,
    localNodesRef,
    innerOnNodesChange,
    dragTargetPanelId,
    unparentCandidatePanelId,
    onNodeDragStop,
    eventHandlers,
    isPanelOpen,
    showSearch,
    setShowSearch,
    showDiagramSidebar,
    setShowDiagramSidebar,
    showCommandPalette,
    setShowCommandPalette,
    handleSelectDiagram,
    handleSearchSelect,
  };
}
