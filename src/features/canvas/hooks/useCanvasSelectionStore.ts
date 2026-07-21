import { create } from "zustand";

interface CanvasSelectionState {
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeId: (id: string | null) => void;
  clearSelection: () => void;
}

export const useCanvasSelectionStore = create<CanvasSelectionState>((set) => ({
  selectedNodeId: null,
  selectedNodeIds: new Set<string>(),
  selectedEdgeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),
  clearSelection: () =>
    set({ selectedNodeId: null, selectedNodeIds: new Set(), selectedEdgeId: null }),
}));