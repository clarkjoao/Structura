import {
  LAST_LOCAL_STORAGE_SYNC_STORAGE_KEY,
  LOCAL_STORAGE_SYNCED_EVENT_NAME,
} from "@/infrastructure/persistence/localStorageSyncTimestamp";
import { useLastSync } from "./useLastSync";

export function useLastLocalStorageSync(): number | null {
  return useLastSync(LAST_LOCAL_STORAGE_SYNC_STORAGE_KEY, LOCAL_STORAGE_SYNCED_EVENT_NAME);
}
