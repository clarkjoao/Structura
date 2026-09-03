import type { StorageHealthLevel } from "./saveStatus.store";
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
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) ?? "";
      total += (key.length + value.length) * 2;
    }
    return total;
  } catch {
    return 0;
  }
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
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  const after = measureLocalStorageUsage();
  return Math.max(0, before - after);
}

/** Runs a measurement and updates the store. */
export function checkStorageHealth(): void {
  const used = measureLocalStorageUsage();
  useSaveStatusStore.getState()._setStorageUsage(used);
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
