import {
  FOLDER_SYNCED_EVENT_NAME,
  LAST_FOLDER_SYNC_STORAGE_KEY,
} from "@/infrastructure/persistence/folderSyncTimestamp";
import { useLastSync } from "./useLastSync";

export function useLastFolderSync(): number | null {
  return useLastSync(LAST_FOLDER_SYNC_STORAGE_KEY, FOLDER_SYNCED_EVENT_NAME);
}
