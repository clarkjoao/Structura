import { create } from "zustand";

/**
 * What a reader asked to see of a shared element's hidden edges: "Show the N
 * edges". A view state, per window, never saved — the diagram keeps its mode.
 */
interface SharedRevealState {
  originals: ReadonlySet<string>;
  toggleOriginal: (originalId: string) => void;
  clear: () => void;
}

const NONE: ReadonlySet<string> = new Set();

export const useSharedRevealStore = create<SharedRevealState>((set) => ({
  originals: NONE,
  toggleOriginal: (originalId) =>
    set((state) => {
      const next = new Set(state.originals);
      if (next.has(originalId)) next.delete(originalId);
      else next.add(originalId);
      return { originals: next };
    }),
  clear: () => set({ originals: NONE }),
}));
