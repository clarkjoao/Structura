import { useEffect } from "react";
import { checkStorageHealth } from "./storage-monitor";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Mount at the canvas / model explorer layout level.
 * Checks localStorage usage periodically and after hydration.
 */
export function useStorageMonitor(): void {
  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      checkStorageHealth();
    }, 2000);

    const interval = window.setInterval(checkStorageHealth, CHECK_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);
}
