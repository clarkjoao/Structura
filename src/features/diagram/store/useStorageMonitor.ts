import { checkStorageHealth } from "./storage-monitor";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Starts periodic localStorage health checks after a short delay.
 * Domain-only (no React) — mount via a UI hook that calls this in an effect.
 *
 * @example
 * useEffect(() => startStorageMonitor(), []);
 */
export function startStorageMonitor(): () => void {
  const initialTimer = window.setTimeout(() => {
    checkStorageHealth();
  }, 2000);

  const interval = window.setInterval(checkStorageHealth, CHECK_INTERVAL_MS);

  return () => {
    window.clearTimeout(initialTimer);
    window.clearInterval(interval);
  };
}
