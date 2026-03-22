import { useEffect } from "react";
import { startFileSystemSync } from "./fileSystemBoot";

/**
 * Hook that ensures the singleton store→disk sync subscription is running.
 * Safe to call from any component — the subscription starts once and persists
 * for the app lifetime (it is NOT torn down on unmount).
 */
export function useFileSystemSync() {
  useEffect(() => {
    startFileSystemSync();
  }, []);
}
