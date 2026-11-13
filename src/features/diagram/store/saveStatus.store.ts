import { create } from "zustand";

export type SaveStatus = "idle" | "pending" | "saved" | "error";

/** localStorage: thresholds in bytes (chars × 2, UTF-16) of its ~5 MB. */
const STORAGE_WARNING_BYTES = 3 * 1024 * 1024;
const STORAGE_DANGER_BYTES = 4 * 1024 * 1024;
/** IndexedDB: thresholds as a share of the origin quota (`navigator.storage.estimate()`). */
const STORAGE_WARNING_SHARE = 0.8;
const STORAGE_DANGER_SHARE = 0.95;

function thresholds(quotaBytes: number | null): { warning: number; danger: number } {
  if (quotaBytes === null) return { warning: STORAGE_WARNING_BYTES, danger: STORAGE_DANGER_BYTES };
  return { warning: quotaBytes * STORAGE_WARNING_SHARE, danger: quotaBytes * STORAGE_DANGER_SHARE };
}

export type StorageHealthLevel = "ok" | "warning" | "danger" | "critical";

interface SaveStatusState {
  status: SaveStatus;
  lastSavedAt: number | null;
  _setSaving: () => void;
  _setSaved: () => void;
  _setError: () => void;

  storageUsedBytes: number;
  /** The origin quota when the workspace is in IndexedDB; null for localStorage (~5 MB). */
  storageQuotaBytes: number | null;
  storageHealthLevel: StorageHealthLevel;
  lastStorageCheckAt: number | null;
  _setStorageUsage: (usedBytes: number, quotaBytes?: number | null) => void;
  _setStorageCritical: () => void;
}

export const useSaveStatusStore = create<SaveStatusState>((set, get) => ({
  status: "idle",
  lastSavedAt: null,
  _setSaving: () => set({ status: "pending" }),
  _setSaved: () => set({ status: "saved", lastSavedAt: Date.now() }),
  _setError: () => set({ status: "error" }),

  storageUsedBytes: 0,
  storageQuotaBytes: null,
  storageHealthLevel: "ok",
  lastStorageCheckAt: null,

  _setStorageUsage: (usedBytes: number, quotaBytes: number | null = null) => {
    const prev = get().storageHealthLevel;
    const { warning, danger } = thresholds(quotaBytes);

    let level: StorageHealthLevel = "ok";
    if (usedBytes >= danger) {
      level = "danger";
    } else if (usedBytes >= warning) {
      level = "warning";
    }

    const measured = {
      storageUsedBytes: usedBytes,
      storageQuotaBytes: quotaBytes,
      lastStorageCheckAt: Date.now(),
    };
    // A failed save stays critical until usage drops below the warning line.
    if (prev === "critical" && usedBytes >= warning) {
      set(measured);
      return;
    }
    set({ ...measured, storageHealthLevel: level });
  },

  _setStorageCritical: () =>
    set({
      storageHealthLevel: "critical",
      lastStorageCheckAt: Date.now(),
    }),
}));
