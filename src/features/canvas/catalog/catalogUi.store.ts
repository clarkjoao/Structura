import { create } from "zustand";

/**
 * Whether the element catalog is open. A store of its own, not Canvas state:
 * the keyboard opens it and the toolbar renders it, and opening it must not
 * re-render the canvas around them.
 */
interface CatalogUiStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  /**
   * Whether a toolbar that can show the catalog is mounted. Opening is refused
   * without one — a shortcut pressed in a read-only view would otherwise leave
   * the catalog to pop open whenever editing came back.
   */
  available: boolean;
  setAvailable: (available: boolean) => void;
}

export const useCatalogUiStore = create<CatalogUiStore>()((set, get) => ({
  open: false,
  setOpen: (open) => {
    if (open && !get().available) return;
    set({ open });
  },
  available: false,
  setAvailable: (available) => set(available ? { available } : { available, open: false }),
}));

/**
 * Marks a canvas overlay that owns the keyboard while it is open (the catalog,
 * quick insert): canvas shortcuts stand down even when focus has left its
 * input. Read by `isCanvasOverlayLayerOpen`.
 */
export const CANVAS_OVERLAY_ATTRIBUTE = "data-canvas-overlay";
