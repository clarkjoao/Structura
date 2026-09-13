import { useEffect } from "react";
import { startStorageMonitor } from "@/features/diagram";

/**
 * Mount at the canvas / model explorer layout level.
 * Checks localStorage usage periodically and after hydration.
 */
export function useStorageMonitor(): void {
  useEffect(() => startStorageMonitor(), []);
}
