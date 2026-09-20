import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ReactFlowInstance } from "@xyflow/react";
import type {
  Diagram,
  DiagramModel,
  ComponentType,
  Component,
  ClipboardEntry,
  Connection,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import { getCachedCanvasSnapshot } from "@/features/diagram";
import { exportDrawio } from "@/lib/export-service";
import { useCopyPasteShortcuts } from "./keyboard/useCopyPasteShortcuts";
import { KEY, type KeyHandler } from "./keyboard/helpers";
import { useRecordingShortcuts } from "./keyboard/useRecordingShortcuts";
import { useSelectionShortcuts } from "./keyboard/useSelectionShortcuts";
import { useUndoRedoShortcuts } from "./keyboard/useUndoRedoShortcuts";
import { useGroupShortcuts } from "./keyboard/useGroupShortcuts";
import { useEdgeWaypointShortcuts } from "./keyboard/useEdgeWaypointShortcuts";
import { useLockShortcuts } from "./keyboard/useLockShortcuts";
import { createToolShortcuts } from "./keyboard/createToolShortcuts";
import {
  dispatchCanvasKeydown,
  type CanvasKeydownDispatch,
} from "./keyboard/dispatchCanvasKeydown";
import { importSvgMarkupToCanvas } from "../utils/importSvgToCanvas";
import { useCanvasMediaPaste } from "./useCanvasMediaPaste";

interface UseCanvasKeyboardParams {
  diagram: Diagram | DiagramModel | null | undefined;
  setCompareScene: (sceneId: string | null) => void;
  isCompareMode?: boolean;
  services: Record<string, ServiceDefinition>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setContextMenu: (v: null) => void;
  undo: () => void;
  redo: () => void;
  removeElements: (nodeIds: string[], edgeIds: string[]) => void;
  groupNodes: (ids: string[]) => string | null;
  ungroupNodes: (panelId: string) => void;
  setParent: (childId: string, parentId: string | null) => void;
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;
  copyToClipboard: (ids: string[]) => void;
  pasteFromClipboard: (position?: { x: number; y: number }) => string[];
  importDrawioResult: (
    components: Component[],
    connections: Connection[],
    layouts: NodeLayout[],
  ) => string[];
  hydrateClipboard: (entry: ClipboardEntry) => void;
  clearClipboard: () => void;
  addComponent: (
    type: ComponentType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
    awsService?: string,
  ) => Component;
  isPanelOpen: boolean;
  isFlowPanelOpen: boolean;
  isPlaying?: boolean;
  isRecording?: boolean;
  isSearchOpen?: boolean;
  onOpenSearch?: () => void;
  isScenesDrawerOpen?: boolean;
  onCloseScenesDrawer?: () => void;
  isCommandPaletteOpen?: boolean;
  onToggleDiagramSidebar?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenQuickInsert?: (params: {
    screenPos: { x: number; y: number };
    flowPos: { x: number; y: number };
  }) => void;
  onAutoLayout?: () => void;
  forceSaveToFolder: () => void | Promise<void>;
  resetEdgeControlPoints: (diagramId: string, connectionId: string) => void;
  updateComponent: (id: string, patch: { locked?: boolean }) => void;
  /** Phase 4 — decision #5, layer 1: cancel in-progress gesture on Esc. */
  cancelInFlightGesture?: () => boolean;
  /** Phase 4 — decision #5, layer 2: exit transient mode on Esc. */
  onExitFlowPlayback?: () => boolean;
  onExitFocusMode?: () => boolean;
  onExitCompareMode?: () => boolean;
}

function useStableHandlerRef(handler: KeyHandler): MutableRefObject<KeyHandler> {
  const ref = useRef(handler);
  ref.current = handler;
  return ref;
}

export function useCanvasKeyboard(params: UseCanvasKeyboardParams) {
  const { t } = useTranslation();
  const lastPointerScreenRef = useRef<{ x: number; y: number } | null>(null);
  const mediaPasteConsumedRef = useRef(false);
  const c4ShortcutMap = useMemo<Record<string, { type: ComponentType; name: string } | undefined>>(
    () => ({
      [KEY.DIGIT_1]: { type: "person", name: t("keyboard.newPerson") },
      [KEY.DIGIT_2]: { type: "system", name: t("keyboard.newSystem") },
      [KEY.DIGIT_3]: { type: "container", name: t("keyboard.newContainer") },
      [KEY.DIGIT_4]: { type: "component", name: t("keyboard.newComponent") },
    }),
    [t],
  );

  const {
    diagram,
    setCompareScene,
    isCompareMode = false,
    services,
    selectedNodeId,
    selectedEdgeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu,
    undo,
    redo,
    removeElements,
    groupNodes,
    ungroupNodes,
    setParent,
    updateNodeLayout,
    copyToClipboard,
    pasteFromClipboard,
    importDrawioResult,
    hydrateClipboard,
    clearClipboard,
    addComponent,
    isPanelOpen,
    isFlowPanelOpen,
    isPlaying = false,
    isRecording = false,
    isSearchOpen,
    isScenesDrawerOpen,
    onCloseScenesDrawer,
    isCommandPaletteOpen,
    onOpenSearch,
    onToggleDiagramSidebar,
    onOpenCommandPalette,
    onOpenQuickInsert,
    onAutoLayout,
    forceSaveToFolder,
    resetEdgeControlPoints,
    updateComponent,
    cancelInFlightGesture,
    onExitFlowPlayback,
    onExitFocusMode,
    onExitCompareMode,
  } = params;

  const resolvedSnapshot = useMemo(
    () => (diagram ? getCachedCanvasSnapshot(diagram) : null),
    [diagram],
  );

  const exportDrawioXml = useCallback(
    (ids: string[]): string => {
      if (!diagram) return "";
      return exportDrawio(diagram, services, { componentIds: ids });
    },
    [diagram, services],
  );

  const pasteSvgAsCanvasNode = useCallback(
    (rawSvg: string, position: { x: number; y: number }): string | null => {
      if (!diagram) return null;
      return importSvgMarkupToCanvas({
        rawSvg,
        position,
        showBorder: false,
        importDrawioResult,
        translate: t,
      });
    },
    [diagram, importDrawioResult, t],
  );

  useCanvasMediaPaste({
    enabled: Boolean(diagram),
    mediaPasteConsumedRef,
    reactFlowInstance,
    reactFlowWrapperRef,
    lastPointerScreenRef,
    importDrawioResult,
    setSelectedNodeIds,
  });

  const handleCopyPaste = useCopyPasteShortcuts({
    diagram,
    selectedNodeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    copyToClipboard,
    pasteFromClipboard,
    importDrawioResult,
    hydrateClipboard,
    pasteSvgAsCanvasNode,
    services,
    exportDrawioXml,
    setSelectedNodeIds,
    lastPointerScreenRef,
    mediaPasteConsumedRef,
    translate: t,
  });

  const recordingHandler = useRecordingShortcuts();
  const selectionHandler = useSelectionShortcuts({
    diagram,
    selectedNodeId,
    selectedEdgeId,
    reactFlowInstance,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu,
    clearClipboard,
    removeElements,
    cancelInFlightGesture,
    onExitFlowPlayback,
    onExitFocusMode,
    onExitCompareMode,
  });
  const undoRedoHandler = useUndoRedoShortcuts({ undo, redo });
  const groupHandler = useGroupShortcuts({
    diagram,
    reactFlowInstance,
    selectedNodeId,
    groupNodes,
    ungroupNodes,
    setParent,
    updateNodeLayout,
    resolvedSnapshot,
  });
  const edgeWaypointHandler = useEdgeWaypointShortcuts({
    diagram,
    selectedEdgeId,
    reactFlowInstance,
    resetEdgeControlPoints,
  });
  const lockHandler = useLockShortcuts({
    diagram,
    reactFlowInstance,
    selectedNodeId,
    updateComponent,
  });

  const copyPasteRef = useStableHandlerRef(handleCopyPaste);
  const selectionRef = useStableHandlerRef(selectionHandler);
  const undoRedoRef = useStableHandlerRef(undoRedoHandler);
  const groupRef = useStableHandlerRef(groupHandler);
  const edgeWaypointRef = useStableHandlerRef(edgeWaypointHandler);
  const lockRef = useStableHandlerRef(lockHandler);

  const dispatchRef = useRef<CanvasKeydownDispatch | null>(null);
  dispatchRef.current = {
    flags: {
      isCompareMode,
      isPlaying,
      isRecording,
      isFlowPanelOpen,
      isSearchOpen,
      isCommandPaletteOpen,
      isScenesDrawerOpen,
    },
    hasDiagram: Boolean(diagram),
    onCloseScenesDrawer,
    forceSaveToFolder,
    onAutoLayout,
    setCompareScene,
    recordingHandler,
    editHandlers: [
      (event) => copyPasteRef.current(event),
      (event) => selectionRef.current(event),
      (event) => undoRedoRef.current(event),
      (event) => groupRef.current(event),
      (event) => edgeWaypointRef.current(event),
      (event) => lockRef.current(event),
    ],
    toolHandler: createToolShortcuts({
      reactFlowInstance,
      isPanelOpen,
      c4ShortcutMap,
      lastPointerScreenRef,
      onOpenSearch,
      onOpenCommandPalette,
      onToggleDiagramSidebar,
      onOpenQuickInsert,
      addComponent,
      setSelectedNodeId,
      setSelectedNodeIds,
      setSelectedEdgeId,
    }),
  };

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      lastPointerScreenRef.current = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener("pointermove", onPointerMove);
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const dispatch = dispatchRef.current;
      if (!dispatch) return;
      void dispatchCanvasKeydown(event, dispatch);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
