import { useEffect } from "react";
import { checkStorageHealth } from "./storage-monitor";
import { CHECK_INTERVAL_MS } from "@/lib/timing.constants";

/**
 * Mount at the canvas / model explorer layout level.
 * Checks browser storage usage (localStorage, or the origin quota with
 * IndexedDB) periodically and after hydration.
 */
export function useStorageMonitor(): void {
  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void checkStorageHealth();
    }, 2000);

    const interval = window.setInterval(() => void checkStorageHealth(), CHECK_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);
}
