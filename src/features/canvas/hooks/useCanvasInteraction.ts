import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Node, ReactFlowInstance } from "@xyflow/react";
import { useSearchParams, type NavigateFunction } from "react-router-dom";
import { focusComponentsOnCanvas } from "../focus/focusComponents";
import {
  flushDiagramStoreToLocalStorageNow,
  type Diagram,
  type DiagramModel,
  type ServiceDefinition,
} from "@/features/diagram";
import type { CanvasProps } from "../canvas.types";
import type { CanvasInputProfile } from "./useCanvasInputProfile";
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
  diagram: Diagram | DiagramModel | null | undefined;
  allDiagrams: Record<string, Diagram>;
  actions: DiagramActions;
  serviceCatalog: Record<string, ServiceDefinition>;
  compareState: CompareSlice;
  flowState: FlowSlice;
  showScenes: boolean;
  setShowScenes: Dispatch<SetStateAction<boolean>>;
  setFocusTitleTrigger: Dispatch<SetStateAction<number>>;
  onAutoLayout: () => void;
  inputProfile: CanvasInputProfile;
}

export interface UseCanvasInteractionResult {
  handleDrillDown: (elementId: string) => void;
  handlePanelCollapseToggle: (panelId: string) => void;
  navigateToDiagram: (diagramId: string, nodeId?: string) => void;
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

export function useCanvasInteraction(
  params: UseCanvasInteractionParams,
): UseCanvasInteractionResult {
  const {
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
    onAutoLayout,
    inputProfile,
  } = params;

  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const skipInitialFit = !!searchParams.get("serviceId");

  const forceSaveToFolder = useCallback(async () => {
    const fsResult = await forceSaveToConnectedFolder();

    if (fsResult === "ok") {
      toast.success(t("filesystem.savedSuccess"));
      return;
    }

    if (fsResult === "error") {
      toast.error(t("filesystem.saveError"));
      const localOk = await flushDiagramStoreToLocalStorageNow({ force: true });
      if (localOk) {
        toast.success(t("localStorage.savedSuccess"));
      }
      return;
    }

    const localOk = await flushDiagramStoreToLocalStorageNow();
    if (localOk) {
      toast.success(t("localStorage.savedSuccess"));
    }
  }, [t]);

  const diagramNavLocked =
    flowState.isRecording || flowState.isPlaying || compareState.isCompareMode;

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
    clearCanvasSelection: visualState.clearCanvasSelection,
    actions,
    onOpenDiagram: canvasProps.onOpenDiagram,
    diagramSidebarOpen: canvasProps.diagramSidebarOpen,
    onDiagramSidebarOpenChange: canvasProps.onDiagramSidebarOpenChange,
    navigate,
    setShowScenes,
  });

  const navigateToDiagram = useCallback(
    (diagramId: string, nodeId?: string) => {
      actions.openDiagram(diagramId);
      navigate(`/model/${diagramId}${nodeId ? `?nodeId=${nodeId}` : ""}`);
    },
    [actions, navigate],
  );

  const { handleDrillDown, handlePanelCollapseToggle } = useCanvasDrillHandlers({
    diagram,
    allDiagrams,
    diagramNavLocked,
    clearCanvasSelection: visualState.clearCanvasSelection,
    updateComponent: actions.updateComponent,
    openDiagram: actions.openDiagram,
    navigate,
    onOpenDiagram: canvasProps.onOpenDiagram,
    onDrillDownToDiagram: canvasProps.onDrillDownToDiagram,
  });

  const localNodesRef = useRef<Node[]>([]);
  const {
    dragTargetPanelId,
    unparentCandidatePanelId,
    onNodesChange: innerOnNodesChange,
    onNodeDragStop,
  } = useNodeDragParenting({
    diagram,
    nodes: localNodesRef.current,
    updateNodeLayout: actions.updateNodeLayout,
    commitNodeDrag: actions.commitNodeDrag,
    batchCommitNodeDrag: actions.batchCommitNodeDrag,
  });

  // Reset focus title trigger when selection changes (e.g., user selects a different node).
  // This signals any child component focused on a title input to clear/blur.
  useEffect(() => {
    setFocusTitleTrigger(0);
  }, [visualState.selectedNodeId, visualState.selectedEdgeId, setFocusTitleTrigger]);

  // Request focus title: increment trigger to signal child to focus title input.
  const handleRequestFocusTitle = useCallback(() => {
    setFocusTitleTrigger((value) => value + 1);
  }, [setFocusTitleTrigger]);

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
      focusComponentsOnCanvas(reactFlowInstance, visualState, [componentId]);
    },
    [reactFlowInstance, setShowSearch, visualState],
  );

  useCanvasKeyboard({
    diagram,
    setCompareScene: actions.setCompareScene,
    isCompareMode: compareState.isCompareMode,
    serviceCatalog,
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
    removeElements: actions.removeElements,
    groupNodes: actions.groupNodes,
    ungroupNodes: actions.ungroupNodes,
    setParent: actions.setParent,
    updateNodeLayout: actions.updateNodeLayout,
    copyToClipboard: actions.copyToClipboard,
    pasteFromClipboard: actions.pasteFromClipboard,
    importDrawioResult: actions.importDrawioResult,
    hydrateClipboard: actions.hydrateClipboard,
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
    onAutoLayout,
    forceSaveToFolder,
    resetEdgeControlPoints: actions.resetEdgeControlPoints,
    updateComponent: actions.updateComponent,
  });

  useCanvasEffects({
    diagram,
    reactFlowInstance,
    isPlaying: flowState.isPlaying,
    activeFlow: flowState.activeFlow,
    currentStepId: flowState.currentStepId,
    onClearSelection: visualState.clearCanvasSelection,
    skipInitialFit,
    inputProfile,
  });

  return {
    handleDrillDown,
    handlePanelCollapseToggle,
    navigateToDiagram,
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
