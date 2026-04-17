import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ReactFlowInstance } from "@xyflow/react";
import type {
  Diagram,
  DiagramModel,
  ComponentType,
  Component,
  Connection,
  NodeLayout,
  ServiceDefinition,
  SvgComponent,
} from "@/features/diagram";
import {
  COMPONENT_TYPE_SVG,
  generateId,
  getCachedCanvasSnapshot,
} from "@/features/diagram";
import { getViewportCenter } from "../viewport-utils";
import { exportDrawio } from "@/lib/export-service";
import { useCopyPasteShortcuts } from "./keyboard/useCopyPasteShortcuts";
import { isInputFocused, isModKeyPressed } from "./keyboard/helpers";
import { useRecordingShortcuts } from "./keyboard/useRecordingShortcuts";
import { useSelectionShortcuts } from "./keyboard/useSelectionShortcuts";
import { useUndoRedoShortcuts } from "./keyboard/useUndoRedoShortcuts";
import { useGroupShortcuts } from "./keyboard/useGroupShortcuts";
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

interface UseCanvasKeyboardParams {
  diagram: Diagram | DiagramModel | null | undefined;
  setCompareScene: (sceneId: string | null) => void;
  isCompareMode?: boolean;
  serviceRegistry: Record<string, ServiceDefinition>;
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
  removeComponent: (id: string) => void;
  removeConnection: (id: string) => void;
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
  forceSaveToFolder: () => void | Promise<void>;
}

const KEY = {
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
  A: "a",
  C: "c",
  D: "d",
  Q: "q",
  S: "s",
  E: "e",
  F: "f",
  G: "g",
  K: "k",
  N: "n",
  B: "b",
  V: "v",
  Z: "z",
  SLASH: "/",
  BACKTICK: "`",
  PLUS_SIGN: "+",
} as const;

export function useCanvasKeyboard(params: UseCanvasKeyboardParams) {
  const { t } = useTranslation();
  const lastPointerScreenRef = useRef<{ x: number; y: number } | null>(null);
  const c4ShortcutMap = useMemo(
    () =>
      ({
        "1": { type: "person" as const, name: t("keyboard.newPerson") },
        "2": { type: "system" as const, name: t("keyboard.newSystem") },
        "3": { type: "container" as const, name: t("keyboard.newContainer") },
        "4": { type: "component" as const, name: t("keyboard.newComponent") },
      }) satisfies Record<string, { type: ComponentType; name: string }>,
    [t],
  );

  const {
    diagram,
    setCompareScene,
    isCompareMode = false,
    serviceRegistry,
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
    removeComponent,
    removeConnection,
    groupNodes,
    ungroupNodes,
    setParent,
    updateNodeLayout,
    copyToClipboard,
    pasteFromClipboard,
    importDrawioResult,
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
    forceSaveToFolder,
  } = params;

  const resolvedSnapshot = useMemo(
    () => (diagram ? getCachedCanvasSnapshot(diagram) : null),
    [diagram],
  );

  const exportDrawioXml = useCallback(
    (ids: string[]): string => {
      if (!diagram) return "";
      return exportDrawio(diagram, serviceRegistry, { componentIds: ids });
    },
    [diagram, serviceRegistry],
  );

  const pasteSvgAsCanvasNode = useCallback(
    (rawSvg: string, position: { x: number; y: number }): string | null => {
      if (!diagram) return null;

      const clean = prepareImportedSvgMarkup(rawSvg, t);
      if (!clean) return null;

      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, "image/svg+xml");
      const svgEl = doc.querySelector("svg");
      let width = 200;
      let height = 200;
      if (svgEl) {
        const vb = svgEl.getAttribute("viewBox")?.trim().split(/[\s,]+/);
        if (vb && vb.length === 4) {
          const vw = parseFloat(vb[2] ?? "");
          const vh = parseFloat(vb[3] ?? "");
          if (vw > 0) width = Math.round(vw);
          if (vh > 0) height = Math.round(vh);
        } else {
          const w = parseFloat(svgEl.getAttribute("width") ?? "");
          const h = parseFloat(svgEl.getAttribute("height") ?? "");
          if (w > 0) width = Math.round(w);
          if (h > 0) height = Math.round(h);
        }
        const MAX = 800;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
      }

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

  const pastedSvgDefaultName = t("icons.pastedSvgDefaultName");

  const handleCopyPaste = useCopyPasteShortcuts({
    diagram,
    selectedNodeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    copyToClipboard,
    pasteFromClipboard,
    importDrawioResult,
    pasteSvgAsCanvasNode,
    importSvgForIconLibrary,
    serviceRegistry,
    exportDrawioXml,
    setSelectedNodeIds,
    pastedSvgDefaultName,
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
    removeComponent,
    removeConnection,
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

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      lastPointerScreenRef.current = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener("pointermove", onPointerMove);
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, []);

  useEffect(() => {
    const handler = async (event: KeyboardEvent) => {
      if (isInputFocused(event.target)) return;

      if (isScenesDrawerOpen) {
        if (event.key === KEY.ESCAPE) {
          event.preventDefault();
          onCloseScenesDrawer?.();
        }
        return;
      }

      const modForFolderSave = isModKeyPressed(event);
      if (
        modForFolderSave &&
        (event.key === KEY.S || event.key === "S") &&
        !isFlowPanelOpen &&
        !isPlaying &&
        !isCompareMode &&
        !isRecording &&
        !isSearchOpen &&
        !isCommandPaletteOpen
      ) {
        event.preventDefault();
        void forceSaveToFolder();
        return;
      }

      if (!diagram) return;

      if (recordingHandler(event)) return;

      if (event.key === KEY.ESCAPE && isCompareMode) {
        if (isPlaying) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        setCompareScene(null);
        return;
      }

      if (isCompareMode) {
        if (event.key === KEY.DELETE || event.key === KEY.BACKSPACE) {
          event.preventDefault();
          return;
        }
        if (
          isModKeyPressed(event) &&
          (event.key === "v" ||
            event.key === "V" ||
            event.key === "d" ||
            event.key === "D" ||
            event.key === "c" ||
            event.key === "C")
        ) {
          event.preventDefault();
          return;
        }
      }

      if (isFlowPanelOpen || isPlaying || isCompareMode || isRecording) return;

      if (isSearchOpen || isCommandPaletteOpen) return;

      if (await handleCopyPaste(event)) return;

      if (selectionHandler(event)) return;

      if (undoRedoHandler(event)) return;

      if (groupHandler(event)) return;

      const mod = isModKeyPressed(event);

      
      if (mod && (event.key === KEY.F || event.key === "F")) {
        event.preventDefault();
        onOpenSearch?.();
        return;
      }

      
      if (mod && (event.key === KEY.K || event.key === "K")) {
        event.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      
      if (mod && (event.key === KEY.B || event.key === "B")) {
        event.preventDefault();
        onToggleDiagramSidebar?.();
        return;
      }

      
      if (mod && event.key === KEY.SLASH) {
        event.preventDefault();
        onOpenSearch?.();
        return;
      }

      
      if (mod && c4ShortcutMap[event.key]) {
        event.preventDefault();
        const { type, name } = c4ShortcutMap[event.key];
        const pos = getViewportCenter(reactFlowInstance, isPanelOpen);
        addComponent(type, name, null, pos);
        return;
      }
      if (mod && event.key === KEY.E) {
        event.preventDefault();
        const lastScreen = lastPointerScreenRef.current;
        if (lastScreen) {
          onOpenQuickInsert?.({
            screenPos: lastScreen,
            flowPos: reactFlowInstance.screenToFlowPosition(lastScreen),
          });
        } else {
          onOpenQuickInsert?.({
            screenPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            flowPos: getViewportCenter(reactFlowInstance, isPanelOpen),
          });
        }
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    diagram,
    setCompareScene,
    isCompareMode,
    isPlaying,
    isRecording,
    isFlowPanelOpen,
    isSearchOpen,
    isScenesDrawerOpen,
    onCloseScenesDrawer,
    isCommandPaletteOpen,
    forceSaveToFolder,
    recordingHandler,
    handleCopyPaste,
    importDrawioResult,
    serviceRegistry,
    selectionHandler,
    undoRedoHandler,
    groupHandler,
    onOpenSearch,
    onToggleDiagramSidebar,
    onOpenCommandPalette,
    onOpenQuickInsert,
    c4ShortcutMap,
    reactFlowInstance,
    isPanelOpen,
    addComponent,
  ]);
}
