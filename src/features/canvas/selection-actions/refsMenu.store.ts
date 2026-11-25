import { create } from "zustand";

/**
 * Which element's references menu is open. The canvas opens it when a shared chip or badge is
 * picked, so what the hover popover used to show is one click away, in one place.
 */
interface RefsMenuState {
  openFor: string | null;
  setOpenFor: (id: string | null) => void;
}

export const useRefsMenuStore = create<RefsMenuState>((set) => ({
  openFor: null,
  setOpenFor: (openFor) => set({ openFor }),
}));
