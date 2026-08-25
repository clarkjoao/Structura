import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * How an unmodified wheel event is interpreted on the canvas.
 *
 * `"pan"` is the draw.io default and the safe one: misreading a mouse as a trackpad only
 * scrolls, while the reverse zooms unexpectedly. `Ctrl`/`Cmd`+wheel always zooms, whatever
 * the mode, which is also how browsers deliver a trackpad pinch.
 */
export type CanvasScrollMode = "pan" | "zoom";

export interface CanvasPreferencesStore {
  scrollMode: CanvasScrollMode;
  setScrollMode: (mode: CanvasScrollMode) => void;
  /** The minimap costs screen space on small viewports, so it is opt-out rather than fixed. */
  showMiniMap: boolean;
  setShowMiniMap: (show: boolean) => void;
}

export const CANVAS_PREFERENCES_KEY = "structura:canvas-preferences";

export const useCanvasPreferencesStore = create<CanvasPreferencesStore>()(
  persist(
    (set) => ({
      scrollMode: "pan",
      setScrollMode: (mode) => set({ scrollMode: mode }),
      showMiniMap: true,
      setShowMiniMap: (show) => set({ showMiniMap: show }),
    }),
    {
      name: CANVAS_PREFERENCES_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
