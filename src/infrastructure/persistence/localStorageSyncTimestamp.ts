export const LAST_LOCAL_STORAGE_SYNC_STORAGE_KEY = "structura:lastLocalStorageSync";

export const LOCAL_STORAGE_SYNCED_EVENT_NAME = "structura:localStorageSynced";

export function recordLocalStorageDiagramSyncSuccess(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_LOCAL_STORAGE_SYNC_STORAGE_KEY, Date.now().toString());
  window.dispatchEvent(new Event(LOCAL_STORAGE_SYNCED_EVENT_NAME));
}

export function clearLocalStorageDiagramSyncTimestamp(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LAST_LOCAL_STORAGE_SYNC_STORAGE_KEY);
  window.dispatchEvent(new Event(LOCAL_STORAGE_SYNCED_EVENT_NAME));
}
