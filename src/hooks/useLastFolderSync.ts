import { useEffect, useState } from "react";
import {
  FOLDER_SYNCED_EVENT_NAME,
  LAST_FOLDER_SYNC_STORAGE_KEY,
} from "@/infrastructure/persistence/folderSyncTimestamp";

function readLastFolderSyncFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_FOLDER_SYNC_STORAGE_KEY);
  if (raw === null) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function useLastFolderSync(): number | null {
  const [lastSync, setLastSync] = useState<number | null>(() =>
    readLastFolderSyncFromStorage(),
  );

  useEffect(() => {
    const handler = (): void => {
      setLastSync(readLastFolderSyncFromStorage());
    };
    window.addEventListener(FOLDER_SYNCED_EVENT_NAME, handler);
    return () => window.removeEventListener(FOLDER_SYNCED_EVENT_NAME, handler);
  }, []);

  return lastSync;
}
