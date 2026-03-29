import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ReactFlowInstance } from "@xyflow/react";
import type {
  Diagram,
  ComponentType,
  Component,
  Connection,
  NodeLayout,
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
import { validateSvgSize } from "../utils/svg.utils";
import { sanitizeSvg } from "../utils/svg.sanitizer";

/**
 * Validates SVG size, then sanitizes. Shows toasts on failure.
 * `translate` should be `t` from react-i18next for icon message keys.
 */
export function importSvgComponent(
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
    importDrawioResult,
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

  const importSvgForPaste = useCallback(
    (svgContent: string) => importSvgComponent(svgContent, t),
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
    serviceRegistry,
    exportDrawioXml,
    setSelectedNodeIds,
    importSvgComponent: importSvgForPaste,
    pastedSvgDefaultName,
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
    const handler = async (event: KeyboardEvent) => {
      if (isInputFocused(event.target)) return;

      if (isScenesDrawerOpen) {
        if (event.key === KEY.ESCAPE) {
          event.preventDefault();
          onCloseScenesDrawer?.();
        }
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

      if (isFlowPanelOpen || isPlaying || isCompareMode) return;

      if (isSearchOpen || isCommandPaletteOpen) return;

      if (await handleCopyPaste(event)) return;

      if (selectionHandler(event)) return;

      if (undoRedoHandler(event)) return;

      if (groupHandler(event)) return;

      const mod = isModKeyPressed(event);

      // Cmd/Ctrl+F — open search
      if (mod && (event.key === KEY.F || event.key === "F")) {
        event.preventDefault();
        onOpenSearch?.();
        return;
      }

      // Cmd/Ctrl+K — open diagram command palette
      if (mod && (event.key === KEY.K || event.key === "K")) {
        event.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      // Cmd/Ctrl+B — toggle diagram sidebar
      if (mod && (event.key === KEY.B || event.key === "B")) {
        event.preventDefault();
        onToggleDiagramSidebar?.();
        return;
      }

      // Cmd/Ctrl+/ — open search
      if (mod && event.key === KEY.SLASH) {
        event.preventDefault();
        onOpenSearch?.();
        return;
      }

      // Cmd/Ctrl+1–4 — add C4 component
      if (mod && c4ShortcutMap[event.key]) {
        event.preventDefault();
        const { type, name } = c4ShortcutMap[event.key];
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
    importDrawioResult,
    serviceRegistry,
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
