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
  /**
   * Catalog entries the user inserted last, most recent first. A UI preference
   * of this browser — not diagram data, so not in undo history or collab.
   */
  recentCatalogEntryIds: string[];
  recordCatalogEntryUse: (entryId: string) => void;
}

/** How many recent catalog entries are kept. */
export const RECENT_CATALOG_ENTRIES_MAX = 8;

/** `recent` with `entryId` moved to the front, capped. */
export function withRecentCatalogEntry(recent: readonly string[], entryId: string): string[] {
  return [entryId, ...recent.filter((id) => id !== entryId)].slice(0, RECENT_CATALOG_ENTRIES_MAX);
}

export const CANVAS_PREFERENCES_KEY = "structura:canvas-preferences";

export const useCanvasPreferencesStore = create<CanvasPreferencesStore>()(
  persist(
    (set) => ({
      scrollMode: "pan",
      setScrollMode: (mode) => set({ scrollMode: mode }),
      showMiniMap: true,
      setShowMiniMap: (show) => set({ showMiniMap: show }),
      recentCatalogEntryIds: [],
      recordCatalogEntryUse: (entryId) =>
        set((state) => ({
          recentCatalogEntryIds: withRecentCatalogEntry(state.recentCatalogEntryIds, entryId),
        })),
    }),
    {
      name: CANVAS_PREFERENCES_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
