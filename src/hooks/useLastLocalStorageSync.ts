import { useEffect, useState } from "react";
import {
  LAST_LOCAL_STORAGE_SYNC_STORAGE_KEY,
  LOCAL_STORAGE_SYNCED_EVENT_NAME,
} from "@/infrastructure/persistence/localStorageSyncTimestamp";

function readLastLocalStorageSyncFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_LOCAL_STORAGE_SYNC_STORAGE_KEY);
  if (raw === null) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function useLastLocalStorageSync(): number | null {
  const [lastSync, setLastSync] = useState<number | null>(() =>
    readLastLocalStorageSyncFromStorage(),
  );

  useEffect(() => {
    const handler = (): void => {
      setLastSync(readLastLocalStorageSyncFromStorage());
    };
    window.addEventListener(LOCAL_STORAGE_SYNCED_EVENT_NAME, handler);
    return () => window.removeEventListener(LOCAL_STORAGE_SYNCED_EVENT_NAME, handler);
  }, []);

  return lastSync;
}
