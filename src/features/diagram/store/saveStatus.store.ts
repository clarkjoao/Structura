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

/** The level a measurement alone gives; "critical" only ever comes from a failed write. */
function levelFor(usedBytes: number, quotaBytes: number | null): StorageHealthLevel {
  const { warning, danger } = thresholds(quotaBytes);
  if (usedBytes >= danger) return "danger";
  if (usedBytes >= warning) return "warning";
  return "ok";
}

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
  _setSaved: () => {
    const { storageHealthLevel, storageUsedBytes, storageQuotaBytes } = get();
    // A write that went through is proof there is room again: "full" ends here, back to what the
    // last measurement says, instead of waiting for usage to fall under the warning line.
    const health =
      storageHealthLevel === "critical"
        ? { storageHealthLevel: levelFor(storageUsedBytes, storageQuotaBytes) }
        : {};
    set({ status: "saved", lastSavedAt: Date.now(), ...health });
  },
  _setError: () => set({ status: "error" }),

  storageUsedBytes: 0,
  storageQuotaBytes: null,
  storageHealthLevel: "ok",
  lastStorageCheckAt: null,

  _setStorageUsage: (usedBytes: number, quotaBytes: number | null = null) => {
    const prev = get().storageHealthLevel;
    const { warning } = thresholds(quotaBytes);
    const level = levelFor(usedBytes, quotaBytes);

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
