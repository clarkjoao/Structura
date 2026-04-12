import { create } from "zustand";

export type SaveStatus = "idle" | "pending" | "saved" | "error";

interface SaveStatusState {
  status: SaveStatus;
  lastSavedAt: number | null;
  _setSaving: () => void;
  _setSaved: () => void;
  _setError: () => void;
}

export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  status: "idle",
  lastSavedAt: null,
  _setSaving: () => set({ status: "pending" }),
  _setSaved: () => set({ status: "saved", lastSavedAt: Date.now() }),
  _setError: () => set({ status: "error" }),
}));
