import { useCallback } from "react";
import type { ReactFlowInstance, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { isModKeyPressed, getSelectedNodes, type KeyHandler } from "./helpers";

interface UseSelectionShortcutsParams {
  diagram: Diagram | null | undefined;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setContextMenu: (v: null) => void;
  clearClipboard: () => void;
  removeComponent: (id: string) => void;
  removeConnection: (id: string) => void;
}

/**
 * Escape — clear selection
 * Cmd+A — select all nodes
 * Delete/Backspace — remove selected nodes and selected edge
 */
export function useSelectionShortcuts({
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
}: UseSelectionShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!diagram) return false;
      const mod = isModKeyPressed(e);

      // Escape — clear selection and context
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
        return true;
      }

      // Cmd/Ctrl+A — select all
      if (mod && e.key === "a") {
        e.preventDefault();
        reactFlowInstance.setNodes((nds: Node[]) => {
          const updated = nds.map((n) => ({ ...n, selected: true }));
          setSelectedNodeIds(new Set(updated.map((n) => n.id)));
          setSelectedNodeId(updated[0]?.id ?? null);
          return updated;
        });
        return true;
      }

      // Delete / Backspace — remove selected nodes or edge
      if (e.key === "Delete" || e.key === "Backspace") {
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
        return true;
      }

      return false;
    },
    [
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
    ],
  );
}
