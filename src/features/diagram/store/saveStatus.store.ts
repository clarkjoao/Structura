import { create } from "zustand";

export type SaveStatus = "idle" | "pending" | "saved" | "error";

/** Thresholds em bytes (localStorage conta chars × 2 para UTF-16) */
const STORAGE_WARNING_BYTES = 3 * 1024 * 1024;
const STORAGE_DANGER_BYTES = 4 * 1024 * 1024;

export type StorageHealthLevel = "ok" | "warning" | "danger" | "critical";

interface SaveStatusState {
  status: SaveStatus;
  lastSavedAt: number | null;
  _setSaving: () => void;
  _setSaved: () => void;
  _setError: () => void;

  storageUsedBytes: number;
  storageHealthLevel: StorageHealthLevel;
  lastStorageCheckAt: number | null;
  _setStorageUsage: (usedBytes: number) => void;
  _setStorageCritical: () => void;
}

export const useSaveStatusStore = create<SaveStatusState>((set, get) => ({
  status: "idle",
  lastSavedAt: null,
  _setSaving: () => set({ status: "pending" }),
  _setSaved: () => set({ status: "saved", lastSavedAt: Date.now() }),
  _setError: () => set({ status: "error" }),

  storageUsedBytes: 0,
  storageHealthLevel: "ok",
  lastStorageCheckAt: null,

  _setStorageUsage: (usedBytes: number) => {
    const prev = get().storageHealthLevel;

    let level: StorageHealthLevel = "ok";
    if (usedBytes >= STORAGE_DANGER_BYTES) {
      level = "danger";
    } else if (usedBytes >= STORAGE_WARNING_BYTES) {
      level = "warning";
    }

    if (prev === "critical") {
      if (usedBytes < STORAGE_WARNING_BYTES) {
        set({
          storageUsedBytes: usedBytes,
          storageHealthLevel: level,
          lastStorageCheckAt: Date.now(),
        });
      } else {
        set({
          storageUsedBytes: usedBytes,
          lastStorageCheckAt: Date.now(),
        });
      }
      return;
    }

    set({
      storageUsedBytes: usedBytes,
      storageHealthLevel: level,
      lastStorageCheckAt: Date.now(),
    });
  },

  _setStorageCritical: () =>
    set({
      storageHealthLevel: "critical",
      lastStorageCheckAt: Date.now(),
    }),
}));
