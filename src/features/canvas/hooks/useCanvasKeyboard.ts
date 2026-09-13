import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
  SvgComponent,
} from "@/features/diagram";
import { COMPONENT_TYPE_SVG, generateId, getCachedCanvasSnapshot } from "@/features/diagram";
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
import { validateSvgSize } from "../utils/svg.utils";
import { sanitizeSvg } from "../utils/svg.sanitizer";

function prepareImportedSvgMarkup(
  svgContent: string,
  translate: (key: string) => string,
): string | null {
  const validation = validateSvgSize(svgContent);
  if (!validation.valid) {
    if (validation.reason === "too_large") {
      toast.error(translate("icons.svgTooLarge"));
    } else {
      toast.error(translate("icons.svgDimensionExceeded"));
    }
    return null;
  }
  const sanitized = sanitizeSvg(svgContent);
  if (sanitized === null) {
    toast.error(translate("icons.invalidSvg"));
    return null;
  }
  return sanitized;
}

function readSvgDisplaySize(svgMarkup: string): { width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  let width = 200;
  let height = 200;
  if (!svgEl) return { width, height };

  const viewBox = svgEl.getAttribute("viewBox")?.trim().split(/[\s,]+/);
  if (viewBox && viewBox.length === 4) {
    const viewWidth = parseFloat(viewBox[2] ?? "");
    const viewHeight = parseFloat(viewBox[3] ?? "");
    if (viewWidth > 0) width = Math.round(viewWidth);
    if (viewHeight > 0) height = Math.round(viewHeight);
  } else {
    const attrWidth = parseFloat(svgEl.getAttribute("width") ?? "");
    const attrHeight = parseFloat(svgEl.getAttribute("height") ?? "");
    if (attrWidth > 0) width = Math.round(attrWidth);
    if (attrHeight > 0) height = Math.round(attrHeight);
  }

  const maxEdge = 800;
  if (width > maxEdge || height > maxEdge) {
    const ratio = Math.min(maxEdge / width, maxEdge / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  return { width, height };
}

interface UseCanvasKeyboardParams {
  diagram: Diagram | DiagramModel | null | undefined;
  setCompareScene: (sceneId: string | null) => void;
  isCompareMode?: boolean;
  serviceCatalog: Record<string, ServiceDefinition>;
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
    serviceCatalog,
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
      return exportDrawio(diagram, serviceCatalog, { componentIds: ids });
    },
    [diagram, serviceCatalog],
  );

  const pasteSvgAsCanvasNode = useCallback(
    (rawSvg: string, position: { x: number; y: number }): string | null => {
      if (!diagram) return null;
      const clean = prepareImportedSvgMarkup(rawSvg, t);
      if (!clean) return null;

      const { width, height } = readSvgDisplaySize(clean);
      const id = generateId("el");
      const comp: SvgComponent = {
        id,
        name: "SVG",
        description: "",
        parentId: null,
        type: COMPONENT_TYPE_SVG,
        svgContent: clean,
      };
      const newIds = importDrawioResult(
        [comp],
        [],
        [{ elementId: id, x: position.x, y: position.y, width, height }],
      );
      return newIds[0] ?? null;
    },
    [diagram, importDrawioResult, t],
  );

  const importSvgForIconLibrary = useCallback(
    (svgContent: string) => prepareImportedSvgMarkup(svgContent, t),
    [t],
  );

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
    importSvgForIconLibrary,
    serviceCatalog,
    exportDrawioXml,
    setSelectedNodeIds,
    pastedSvgDefaultName: t("icons.pastedSvgDefaultName"),
    lastPointerScreenRef,
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
