import { useEffect, useCallback } from "react";
import type { ReactFlowInstance, Node } from "@xyflow/react";
import type {
  Diagram,
  ComponentType,
  Component,
  ServiceDefinition,
} from "@/features/diagram";
import { isPanelType } from "@/features/diagram";
import { getViewportCenter } from "../viewport-utils";
import { useRecordingMode } from "../flow/RecordingModeContext";
import { exportDrawio } from "@/lib/export-service";
import { useCopyPasteShortcuts } from "./keyboard/useCopyPasteShortcuts";

// ── Types ─────────────────────────────────────────────────────────────────

interface UseCanvasKeyboardParams {
  diagram: Diagram | null | undefined;
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
  isSearchOpen?: boolean;
  onOpenSearch?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const C4_SHORTCUT_MAP: Record<string, { type: ComponentType; name: string }> = {
  "1": { type: "person", name: "Novo Person" },
  "2": { type: "system", name: "Novo System" },
  "3": { type: "container", name: "Novo Container" },
  "4": { type: "component", name: "Novo Component" },
};

const KEY = {
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
  A: "a",
  C: "c",
  D: "d",
  F: "f",
  G: "g",
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

function getCopyableIds(diagram: Diagram, nodes: Node[]): string[] {
  return nodes
    .map((n) => n.id)
    .filter((id) => {
      const c = diagram.snapshot.components[id];
      return c && c.type !== "panel" && c.type !== "note";
    });
}

function getPasteCenter(rf: ReactFlowInstance, wrapperRef: React.RefObject<HTMLDivElement | null>): { x: number; y: number } {
  const wrapper = wrapperRef.current;
  if (!wrapper) return { x: 300, y: 300 };
  const rect = wrapper.getBoundingClientRect();
  return rf.screenToFlowPosition({
    x: rect.width / 2,
    y: rect.height / 2,
  });
}

function getCenterOfNodes(diagram: Diagram, ids: string[], offset = 20): { x: number; y: number } {
  const layouts = diagram.nodeLayouts;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const id of ids) {
    const comp = diagram.snapshot.components[id];
    if (!comp) continue;

    const layout = layouts[id];
    let x = layout?.x ?? 0;
    let y = layout?.y ?? 0;

    if (comp.parentId) {
      const parentLayout = layouts[comp.parentId];
      if (parentLayout) {
        x += parentLayout.x;
        y += parentLayout.y;
      }
    }

    sumX += x;
    sumY += y;
    count += 1;
  }

  if (count === 0) return { x: 300, y: 300 };
  return { x: sumX / count + offset, y: sumY / count + offset };
}

// ── Main hook ─────────────────────────────────────────────────────────────

export function useCanvasKeyboard(params: UseCanvasKeyboardParams) {
  const { isRecording, onRecordUndo } = useRecordingMode();
  const {
    diagram,
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
    copyToClipboard,
    pasteFromClipboard,
    clearClipboard,
    addComponent,
    isPanelOpen,
    isFlowPanelOpen,
    isSearchOpen,
    onOpenSearch,
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

      // Block shortcuts when flow panel is open
      if (isFlowPanelOpen) return;

      // Block all other canvas shortcuts while search is open
      if (isSearchOpen) return;

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

      // Cmd/Ctrl+Shift+G — ungroup panel
      if (mod && e.shiftKey && e.key === KEY.G) {
        e.preventDefault();
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        if (selected.length === 1 && isPanelType(selected[0].type as string)) {
          ungroupNodes(selected[0].id);
        }
        return;
      }

      // Cmd/Ctrl+G — group selected
      if (mod && e.key === KEY.G) {
        e.preventDefault();
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

      // Cmd/Ctrl+/ — open search
      if (mod && e.key === KEY.SLASH) {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      // Cmd/Ctrl+1–4 — add C4 component
      if (mod && C4_SHORTCUT_MAP[e.key]) {
        e.preventDefault();
        const { type, name } = C4_SHORTCUT_MAP[e.key];
        const pos = getViewportCenter(reactFlowInstance, isPanelOpen);
        addComponent(type, name, null, pos);
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    diagram,
    serviceRegistry,
    selectedNodeId,
    selectedEdgeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    isRecording,
    isFlowPanelOpen,
    isSearchOpen,
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
    copyToClipboard,
    pasteFromClipboard,
    undo,
    redo,
    addComponent,
    isPanelOpen,
    onOpenSearch,
  ]);
}
