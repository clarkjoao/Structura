import { useEffect } from "react";
import type { ReactFlowInstance, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";

interface UseCanvasKeyboardParams {
  diagram: Diagram | null | undefined;
  selectedNodeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
  isRecording: boolean | undefined;
  onRecordUndo: (() => void) | undefined;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setContextMenu: (v: null) => void;
  undo: () => void;
  redo: () => void;
  removeComponent: (id: string) => void;
  groupNodes: (ids: string[]) => string | null;
  ungroupNodes: (panelId: string) => void;
  copyToClipboard: (ids: string[]) => void;
  pasteFromClipboard: (position?: { x: number; y: number }) => void;
  clearClipboard: () => void;
}

export function useCanvasKeyboard({
  diagram,
  selectedNodeId,
  reactFlowInstance,
  reactFlowWrapperRef,
  isRecording,
  onRecordUndo,
  setSelectedNodeId,
  setSelectedNodeIds,
  setSelectedEdgeId,
  setContextMenu,
  undo,
  redo,
  removeComponent,
  groupNodes,
  ungroupNodes,
  copyToClipboard,
  pasteFromClipboard,
  clearClipboard,
}: UseCanvasKeyboardParams) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      )
        return;
      if (!diagram) return;

      if (isRecording) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          onRecordUndo?.();
        }
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        e.preventDefault();
        clearClipboard();
        reactFlowInstance.setNodes((nds: Node[]) =>
          nds.map((n) => ({ ...n, selected: false })),
        );
        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
        setSelectedEdgeId(null);
        setContextMenu(null);
        return;
      }
      if (mod && e.key === "a") {
        e.preventDefault();
        reactFlowInstance.setNodes((nds: Node[]) => {
          const updated = nds.map((n) => ({ ...n, selected: true }));
          setSelectedNodeIds(new Set(updated.map((n) => n.id)));
          setSelectedNodeId(updated[0]?.id ?? null);
          return updated;
        });
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        if (selected.length === 0 && selectedNodeId) {
          removeComponent(selectedNodeId);
          setSelectedNodeId(null);
          setSelectedNodeIds(new Set());
          return;
        }
        if (selected.length > 0) {
          for (const n of selected) removeComponent(n.id);
          setSelectedNodeId(null);
          setSelectedNodeIds(new Set());
        }
        return;
      }
      if (mod && e.key === "c") {
        e.preventDefault();
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        const toCopy =
          selected.length > 0
            ? selected
            : selectedNodeId
              ? reactFlowInstance.getNodes().filter((n) => n.id === selectedNodeId)
              : [];
        const ids = toCopy
          .map((n) => n.id)
          .filter((id) => {
            const c = diagram.snapshot.components[id];
            return c && c.type !== "panel" && c.type !== "note";
          });
        if (ids.length === 0) return;
        copyToClipboard(ids);
        return;
      }
      if (mod && e.key === "v") {
        e.preventDefault();
        const wrapper = reactFlowWrapperRef.current;
        const center = wrapper
          ? reactFlowInstance.screenToFlowPosition({
              x: wrapper.getBoundingClientRect().width / 2,
              y: wrapper.getBoundingClientRect().height / 2,
            })
          : { x: 300, y: 300 };
        pasteFromClipboard(center);
        return;
      }
      if (mod && e.key === "d") {
        e.preventDefault();
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        const toDup =
          selected.length > 0
            ? selected
            : selectedNodeId
              ? reactFlowInstance.getNodes().filter((n) => n.id === selectedNodeId)
              : [];
        const ids = toDup
          .map((n) => n.id)
          .filter((id) => {
            const c = diagram.snapshot.components[id];
            return c && c.type !== "panel" && c.type !== "note";
          });
        if (ids.length === 0) return;
        copyToClipboard(ids);
        const layouts = diagram.nodeLayouts;
        let cx = 0;
        let cy = 0;
        let n = 0;
        for (const id of ids) {
          const comp = diagram.snapshot.components[id];
          if (!comp) continue;
          const layout = layouts.find((nl) => nl.elementId === id);
          let x = layout?.x ?? 0;
          let y = layout?.y ?? 0;
          if (comp.parentId) {
            const parentLayout = layouts.find((nl) => nl.elementId === comp.parentId);
            if (parentLayout) {
              x += parentLayout.x;
              y += parentLayout.y;
            }
          }
          cx += x;
          cy += y;
          n += 1;
        }
        if (n > 0) pasteFromClipboard({ x: cx / n + 20, y: cy / n + 20 });
        return;
      }
      if (mod && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && e.shiftKey && e.key === "g") {
        e.preventDefault();
        const allNodes = reactFlowInstance.getNodes();
        const selected = allNodes.filter((n) => n.selected);
        if (selected.length === 1 && selected[0].type === "panel") {
          ungroupNodes(selected[0].id);
        }
        return;
      }
      if (mod && e.key === "g") {
        e.preventDefault();
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        if (selected.length >= 2) {
          groupNodes(selected.map((n) => n.id));
        }
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    diagram,
    selectedNodeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    undo,
    redo,
    removeComponent,
    groupNodes,
    ungroupNodes,
    copyToClipboard,
    pasteFromClipboard,
    clearClipboard,
    isRecording,
    onRecordUndo,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu,
  ]);
}
