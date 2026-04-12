import { defaultStorage } from "./LocalStorageAdapter";

export const LAST_FOLDER_SYNC_STORAGE_KEY = "structura:lastFolderSync";

export const FOLDER_SYNCED_EVENT_NAME = "structura:folderSynced";

export function recordFolderSyncSuccess(): void {
  if (typeof window === "undefined") return;
  try {
    defaultStorage.setAuxiliaryValue(LAST_FOLDER_SYNC_STORAGE_KEY, Date.now().toString());
    window.dispatchEvent(new Event(FOLDER_SYNCED_EVENT_NAME));
  } catch (error) {
    console.warn("[Structura] recordFolderSyncSuccess", error);
  }
}

export function clearFolderSyncTimestamp(): void {
  if (typeof window === "undefined") return;
  defaultStorage.removeAuxiliaryKey(LAST_FOLDER_SYNC_STORAGE_KEY);
  window.dispatchEvent(new Event(FOLDER_SYNCED_EVENT_NAME));
}
