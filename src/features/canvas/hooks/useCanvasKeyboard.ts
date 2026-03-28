import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ReactFlowInstance } from "@xyflow/react";
import type {
  Diagram,
  ComponentType,
  Component,
  ServiceDefinition,
} from "@/features/diagram";
import { resolveCanvasSnapshot } from "@/features/diagram";
import { getViewportCenter } from "../viewport-utils";
import { exportDrawio } from "@/lib/export-service";
import { useCopyPasteShortcuts } from "./keyboard/useCopyPasteShortcuts";
import { isInputFocused, isModKeyPressed } from "./keyboard/helpers";
import { useRecordingShortcuts } from "./keyboard/useRecordingShortcuts";
import { useSelectionShortcuts } from "./keyboard/useSelectionShortcuts";
import { useUndoRedoShortcuts } from "./keyboard/useUndoRedoShortcuts";
import { useGroupShortcuts } from "./keyboard/useGroupShortcuts";

interface UseCanvasKeyboardParams {
  diagram: Diagram | null | undefined;
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
  isSearchOpen?: boolean;
  onOpenSearch?: () => void;
  isScenesDrawerOpen?: boolean;
  onCloseScenesDrawer?: () => void;
  isCommandPaletteOpen?: boolean;
  onToggleDiagramSidebar?: () => void;
  onOpenCommandPalette?: () => void;
}

const KEY = {
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
  A: "a",
  C: "c",
  D: "d",
  F: "f",
  G: "g",
  K: "k",
  B: "b",
  V: "v",
  Z: "z",
  SLASH: "/",
} as const;

export function useCanvasKeyboard(params: UseCanvasKeyboardParams) {
  const { t } = useTranslation();
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
    clearClipboard,
    addComponent,
    isPanelOpen,
    isFlowPanelOpen,
    isPlaying = false,
    isSearchOpen,
    isScenesDrawerOpen,
    onCloseScenesDrawer,
    isCommandPaletteOpen,
    onOpenSearch,
    onToggleDiagramSidebar,
    onOpenCommandPalette,
  } = params;

  const resolvedSnapshot = useMemo(
    () => (diagram ? resolveCanvasSnapshot(diagram) : null),
    [diagram],
  );

  const exportDrawioXml = useCallback(
    (ids: string[]): string => {
      if (!diagram) return "";
      return exportDrawio(diagram, serviceRegistry, { componentIds: ids });
    },
    [diagram, serviceRegistry],
  );

  const handleCopyPaste = useCopyPasteShortcuts({
    diagram,
    selectedNodeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    copyToClipboard,
    pasteFromClipboard,
    exportDrawioXml,
    setSelectedNodeIds,
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
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused(e.target)) return;

      if (isScenesDrawerOpen) {
        if (e.key === KEY.ESCAPE) {
          e.preventDefault();
          onCloseScenesDrawer?.();
        }
        return;
      }

      if (!diagram) return;

      if (recordingHandler(e)) return;

      if (e.key === KEY.ESCAPE && isCompareMode) {
        if (isPlaying) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        setCompareScene(null);
        return;
      }

      if (isCompareMode) {
        if (e.key === KEY.DELETE || e.key === KEY.BACKSPACE) {
          e.preventDefault();
          return;
        }
        if (
          isModKeyPressed(e) &&
          (e.key === "v" ||
            e.key === "V" ||
            e.key === "d" ||
            e.key === "D" ||
            e.key === "c" ||
            e.key === "C")
        ) {
          e.preventDefault();
          return;
        }
      }

      if (isFlowPanelOpen || isPlaying || isCompareMode) return;

      if (isSearchOpen || isCommandPaletteOpen) return;

      if (handleCopyPaste(e)) return;

      if (selectionHandler(e)) return;

      if (undoRedoHandler(e)) return;

      if (groupHandler(e)) return;

      const mod = isModKeyPressed(e);

      // Cmd/Ctrl+F — open search
      if (mod && (e.key === KEY.F || e.key === "F")) {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      // Cmd/Ctrl+K — open diagram command palette
      if (mod && (e.key === KEY.K || e.key === "K")) {
        e.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      // Cmd/Ctrl+B — toggle diagram sidebar
      if (mod && (e.key === KEY.B || e.key === "B")) {
        e.preventDefault();
        onToggleDiagramSidebar?.();
        return;
      }

      // Cmd/Ctrl+/ — open search
      if (mod && e.key === KEY.SLASH) {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      // Cmd/Ctrl+1–4 — add C4 component
      if (mod && c4ShortcutMap[e.key]) {
        e.preventDefault();
        const { type, name } = c4ShortcutMap[e.key];
        const pos = getViewportCenter(reactFlowInstance, isPanelOpen);
        addComponent(type, name, null, pos);
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
    isFlowPanelOpen,
    isSearchOpen,
    isScenesDrawerOpen,
    onCloseScenesDrawer,
    isCommandPaletteOpen,
    recordingHandler,
    handleCopyPaste,
    selectionHandler,
    undoRedoHandler,
    groupHandler,
    onOpenSearch,
    onToggleDiagramSidebar,
    onOpenCommandPalette,
    c4ShortcutMap,
    reactFlowInstance,
    isPanelOpen,
    addComponent,
  ]);
}
