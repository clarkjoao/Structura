import { useEffect } from "react";
import { checkStorageHealth } from "./storage-monitor";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Montar no nível do layout do canvas / model explorer.
 * Verifica o uso do localStorage periodicamente e após hidratação.
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
