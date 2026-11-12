import { kvGetItem, kvKeys, kvRemoveItem } from "@/infrastructure/persistence/kvStorage";
import type { StorageHealthLevel } from "./saveStatus.store";
import { workspaceStorage } from "@/infrastructure/persistence/workspaceStorage";
import { useSaveStatusStore } from "./saveStatus.store";

/**
 * Subset of `FsStatus` from `infrastructure/persistence` that matters to the
 * "should we push folder sync as the primary CTA?" question. Re-declared
 * here to avoid an infrastructure → features import cycle (useFileSystemStorage
 * already imports from this module). When the persistence layer adds new
 * statuses, update this union to match.
 */
export type FolderSyncStatus =
  "disconnected" | "connecting" | "connected" | "needs_permission" | "error";

/** Soma o tamanho de todas as chaves/valores do localStorage em bytes (UTF-16: char × 2). */
export function measureLocalStorageUsage(): number {
  let total = 0;
  for (const key of kvKeys()) {
    const value = kvGetItem(key) ?? "";
    total += (key.length + value.length) * 2;
  }
  return total;
}

/** Chaves que podem ser limpas sem perda de dados de diagrama. */
const CLEARABLE_KEYS = [
  "structura:llm:history",
  "structura:recentDiagrams",
  "structura:compareTooltipSeen",
  "structura:sidebarFolders",
  "structura:lastEdgeStyle",
  "structura:lastElementCategory",
  "structura:toolbar-collapsed",
];

/**
 * Removes non-essential keys from localStorage.
 * Nunca remove diagram-store ou structura:icon-library.
 * Returns how many bytes were freed.
 */
export function clearNonEssentialStorage(): number {
  const before = measureLocalStorageUsage();
  for (const key of CLEARABLE_KEYS) {
    kvRemoveItem(key);
  }
  const after = measureLocalStorageUsage();
  return Math.max(0, before - after);
}

/**
 * Usage and quota of the origin, when the browser reports them. This is what
 * bounds a workspace in IndexedDB.
 */
async function estimateOriginStorage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return typeof usage === "number" && typeof quota === "number" && quota > 0
      ? { usage, quota }
      : null;
  } catch {
    return null;
  }
}

/**
 * Runs a measurement and updates the store: against the origin quota when the
 * workspace is in IndexedDB, against localStorage's ~5 MB otherwise.
 */
export async function checkStorageHealth(): Promise<void> {
  if (workspaceStorage.location === "indexeddb") {
    const estimate = await estimateOriginStorage();
    if (estimate) {
      useSaveStatusStore.getState()._setStorageUsage(estimate.usage, estimate.quota);
      return;
    }
  }
  useSaveStatusStore.getState()._setStorageUsage(measureLocalStorageUsage());
}

/**
 * When the localStorage budget is heading into trouble (warning or danger)
 * and the user has not yet connected a local folder, the UI should promote
 * folder sync as the primary remediation. Once connected, the user already
 * has a real backup so the existing copy/buttons are enough.
 *
 * Kept as a pure function so the banner can be tested without spinning up
 * the full storage + folder modules.
 */
export function shouldSuggestFolderSync(
  health: StorageHealthLevel,
  folderSyncStatus: FolderSyncStatus,
): boolean {
  const isStressed = health === "warning" || health === "danger";
  return isStressed && folderSyncStatus === "disconnected";
}
