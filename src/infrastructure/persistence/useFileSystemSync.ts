import { useEffect } from "react";
import { startFileSystemSync } from "./fileSystemBoot";

export function useFileSystemSync() {
  useEffect(() => {
    startFileSystemSync();
  }, []);
}
