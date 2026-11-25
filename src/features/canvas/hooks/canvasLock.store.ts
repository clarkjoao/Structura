import { create } from "zustand";

interface CanvasLockState {
  /** The author locked the canvas from the Controls padlock: nothing on it can be edited. */
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

/**
 * The canvas lock the React Flow Controls padlock toggles. Locked, the canvas reads like compare
 * mode: no drag, connect, select, insert, paste or delete; pan and zoom still work. It lasts for
 * the session only, so a reload never opens a diagram that seems frozen.
 */
export const useCanvasLockStore = create<CanvasLockState>((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}));
