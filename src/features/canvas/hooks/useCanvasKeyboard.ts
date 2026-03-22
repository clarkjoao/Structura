import { useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ReactFlowInstance, Node } from "@xyflow/react";
import type {
  Diagram,
  ComponentType,
  Component,
  ServiceDefinition,
} from "@/features/diagram";
import { isPanelComponent, isReactFlowParentPanelType } from "@/features/diagram";
import { getViewportCenter } from "../viewport-utils";
import { useRecordingMode } from "../flow/RecordingModeContext";
import { exportDrawio } from "@/lib/export-service";
import { useCopyPasteShortcuts } from "./keyboard/useCopyPasteShortcuts";
import { toast } from "sonner";
import { isDiagramCompareMode, resolveCanvasSnapshot } from "@/features/diagram";

// ── Types ─────────────────────────────────────────────────────────────────

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
  updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => void;
  copyToClipboard: (ids: string[]) => void;
  pasteFromClipboard: (position?: { x: number; y: number }) => void;
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
  isCommandPaletteOpen?: boolean;
  onToggleDiagramSidebar?: () => void;
  onOpenCommandPalette?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────

type Platform = "mac" | "windows" | "linux";

function getPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator as { platform?: string }).platform?.toLowerCase() ?? "";
  if (platform.includes("mac") || ua.includes("mac")) return "mac";
  if (platform.includes("win") || ua.includes("win")) return "windows";
  if (platform.includes("linux") || ua.includes("linux")) return "linux";
  return "windows";
}

function isModKeyPressed(e: KeyboardEvent): boolean {
  const platform = getPlatform();
  return platform === "mac" ? e.metaKey : e.ctrlKey;
}

function isInputFocused(target: EventTarget | null): boolean {
  const el = target as HTMLElement;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    !!el.isContentEditable
  );
}

function getSelectedNodes(rf: ReactFlowInstance, fallbackId: string | null): Node[] {
  const nodes = rf.getNodes();
  const selected = nodes.filter((n) => n.selected);
  if (selected.length > 0) return selected;
  if (fallbackId) {
    const single = nodes.find((n) => n.id === fallbackId);
    return single ? [single] : [];
  }
  return [];
}

// ── Main hook ─────────────────────────────────────────────────────────────

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
  const { isRecording, onRecordUndo } = useRecordingMode();
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
    isCommandPaletteOpen,
    onOpenSearch,
    onToggleDiagramSidebar,
    onOpenCommandPalette,
  } = params;

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
  });

  const clearSelection = useCallback(() => {
    clearClipboard();
    reactFlowInstance.setNodes((nds: Node[]) =>
      nds.map((n) => ({ ...n, selected: false })),
    );
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [
    clearClipboard,
    reactFlowInstance,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused(e.target)) return;
      if (!diagram) return;

      // Recording mode: only Backspace/Delete triggers undo
      if (isRecording) {
        if (e.key === KEY.DELETE || e.key === KEY.BACKSPACE) {
          e.preventDefault();
          onRecordUndo?.();
        }
        return;
      }

      if (e.key === KEY.ESCAPE && isCompareMode) {
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

      // Block shortcuts when flow panel is open or when playing a flow
      if (isFlowPanelOpen || isPlaying) return;

      // Block canvas shortcuts while search or command palette is open
      if (isSearchOpen || isCommandPaletteOpen) return;

      if (handleCopyPaste(e)) return;

      const mod = isModKeyPressed(e);

      // Escape — clear selection and context
      if (e.key === KEY.ESCAPE) {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Cmd/Ctrl+A — select all
      if (mod && e.key === KEY.A) {
        if (isCompareMode) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        reactFlowInstance.setNodes((nds: Node[]) => {
          const updated = nds.map((n) => ({ ...n, selected: true }));
          setSelectedNodeIds(new Set(updated.map((n) => n.id)));
          setSelectedNodeId(updated[0]?.id ?? null);
          return updated;
        });
        return;
      }

      // Delete / Backspace — remove selected nodes or edge
      if (e.key === KEY.DELETE || e.key === KEY.BACKSPACE) {
        e.preventDefault();
        const selected = getSelectedNodes(reactFlowInstance, selectedNodeId);
        if (selected.length > 0) {
          selected.forEach((n) => removeComponent(n.id));
          setSelectedNodeId(null);
          setSelectedNodeIds(new Set());
        }
        if (selectedEdgeId) {
          removeConnection(selectedEdgeId);
          setSelectedEdgeId(null);
        }
        return;
      }

      // Cmd/Ctrl+Shift+Z — redo
      if (mod && e.shiftKey && (e.key === KEY.Z || e.key === "Z")) {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd/Ctrl+Z — undo
      if (mod && e.key === KEY.Z) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl+Shift+G — ungroup panel or remove from group
      if (mod && e.shiftKey && e.key === KEY.G) {
        e.preventDefault();
        const selected = getSelectedNodes(reactFlowInstance, selectedNodeId);
        if (selected.length === 1) {
          const node = selected[0];
          if (isReactFlowParentPanelType(node.type as string)) {
            ungroupNodes(node.id);
          } else {
            const r = resolveCanvasSnapshot(diagram);
            const comp = r.components[node.id];
            const parentComp = comp?.parentId ? r.components[comp.parentId] : undefined;
            if (comp?.parentId && parentComp && isPanelComponent(parentComp)) {
              const parentLayout = r.nodeLayouts[comp.parentId];
              const childLayout = r.nodeLayouts[node.id];
              if (parentLayout && childLayout) {
                setParent(node.id, null);
                updateNodeLayout(node.id, {
                  x: childLayout.x + parentLayout.x,
                  y: childLayout.y + parentLayout.y,
                });
              }
            }
          }
        }
        return;
      }

      // Cmd/Ctrl+G — group selected
      if (mod && e.key === KEY.G) {
        e.preventDefault();
        if (
          (diagram.activeSceneId && diagram.scenes?.[diagram.activeSceneId]) ||
          isDiagramCompareMode(diagram)
        ) {
          toast.error(t("scenes.groupBlockedInScene"));
          return;
        }
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        if (selected.length >= 2) {
          groupNodes(selected.map((n) => n.id));
        }
        return;
      }

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
        if (isCompareMode) {
          e.preventDefault();
          return;
        }
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
    serviceRegistry,
    selectedNodeId,
    selectedEdgeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    isRecording,
    isFlowPanelOpen,
    isPlaying,
    isSearchOpen,
    isCommandPaletteOpen,
    onRecordUndo,
    handleCopyPaste,
    clearSelection,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu,
    removeComponent,
    removeConnection,
    groupNodes,
    ungroupNodes,
    setParent,
    updateNodeLayout,
    copyToClipboard,
    pasteFromClipboard,
    undo,
    redo,
    addComponent,
    isPanelOpen,
    onOpenSearch,
    onToggleDiagramSidebar,
    onOpenCommandPalette,
    c4ShortcutMap,
    t,
  ]);
}
