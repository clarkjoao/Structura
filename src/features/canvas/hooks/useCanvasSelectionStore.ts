import { create } from "zustand";

interface CanvasSelectionState {
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeId: (id: string | null) => void;
  clearSelection: () => void;
}

/**
 * The two node-selection fields are one selection, not two.
 *
 * INVARIANT: `selectedNodeId === null || selectedNodeIds.has(selectedNodeId)`.
 *
 * `selectedNodeIds` is the selection; `selectedNodeId` is the *primary* member of it (the one the
 * element panel and the quick-actions toolbar describe). They drive different visuals — the
 * primary drives the panel and toolbar, the set drives dimming and React Flow's `selected` flag —
 * so letting them disagree renders a canvas where one node is described and another looks focused.
 * Every writer below re-establishes the invariant, so callers cannot leave the store inconsistent
 * by updating only one field.
 */
function derivePrimary(selectedNodeIds: Set<string>, current: string | null): string | null {
  if (current !== null && selectedNodeIds.has(current)) return current;
  return selectedNodeIds.values().next().value ?? null;
}

export const useCanvasSelectionStore = create<CanvasSelectionState>((set) => ({
  selectedNodeId: null,
  selectedNodeIds: new Set<string>(),
  selectedEdgeId: null,
  setSelectedNodeId: (id) =>
    set((state) => {
      // Promoting a node that is not in the selection means the selection moved to it.
      if (id !== null && !state.selectedNodeIds.has(id)) {
        return { selectedNodeId: id, selectedNodeIds: new Set([id]) };
      }
      return { selectedNodeId: id };
    }),
  setSelectedNodeIds: (ids) =>
    set((state) => {
      const next = typeof ids === "function" ? ids(state.selectedNodeIds) : ids;
      // Dropping the primary from the selection demotes it to another member (or to nothing).
      return { selectedNodeIds: next, selectedNodeId: derivePrimary(next, state.selectedNodeId) };
    }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),
  clearSelection: () =>
    set({ selectedNodeId: null, selectedNodeIds: new Set(), selectedEdgeId: null }),
}));
