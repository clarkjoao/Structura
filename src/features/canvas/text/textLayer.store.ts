import { create } from "zustand";

interface TextLayerState {
  /**
   * The editor's own view of the text layer: texts are drawn while it is on. A
   * local state of the editing session — on by default, never saved. What a
   * viewer, a link or an export shows is the diagram's saved `textsVisible`.
   */
  layerVisible: boolean;
  setLayerVisible: (visible: boolean) => void;
}

export const useTextToolStore = create<TextLayerState>((set) => ({
  layerVisible: true,
  setLayerVisible: (layerVisible) => set({ layerVisible }),
}));
