import { create } from "zustand";

interface TextToolState {
  /** The next click on the empty canvas creates a text there. */
  toolActive: boolean;
  setToolActive: (active: boolean) => void;
}

/** The text tool is a canvas gesture, not diagram data: it is not saved. */
export const useTextToolStore = create<TextToolState>((set) => ({
  toolActive: false,
  setToolActive: (toolActive) => set({ toolActive }),
}));
