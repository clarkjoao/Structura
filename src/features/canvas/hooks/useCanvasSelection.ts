import { useCallback } from "react";
import { useCanvasSelectionStore } from "./useCanvasSelectionStore";

export interface UseCanvasSelectionResult {
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeId: (id: string | null) => void;
  clearSelection: () => void;
}

/** Encapsulates all selection state — selection, highlight, and context-menus depend on it. */
export function useCanvasSelection(_activeDiagramId: string | null): UseCanvasSelectionResult {
  const selectedNodeId = useCanvasSelectionStore((s) => s.selectedNodeId);
  const selectedNodeIds = useCanvasSelectionStore((s) => s.selectedNodeIds);
  const selectedEdgeId = useCanvasSelectionStore((s) => s.selectedEdgeId);
  const setSelectedNodeId = useCanvasSelectionStore((s) => s.setSelectedNodeId);
  const setSelectedNodeIds = useCanvasSelectionStore((s) => s.setSelectedNodeIds);
  const setSelectedEdgeId = useCanvasSelectionStore((s) => s.setSelectedEdgeId);
  const clearSelectionInStore = useCanvasSelectionStore((s) => s.clearSelection);

  const clearSelection = useCallback(() => {
    clearSelectionInStore();
  }, [clearSelectionInStore]);

  return {
    selectedNodeId,
    selectedNodeIds,
    selectedEdgeId,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    clearSelection,
  };
}
