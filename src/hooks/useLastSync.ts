import { useEffect, useState } from "react";

function readTimestampFromStorage(key: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Generic hook that tracks a timestamp stored in localStorage and updates
 * whenever the given event fires.
 */
export function useLastSync(storageKey: string, eventName: string): number | null {
  const [lastSync, setLastSync] = useState<number | null>(() =>
    readTimestampFromStorage(storageKey),
  );

  useEffect(() => {
    const handler = (): void => {
      setLastSync(readTimestampFromStorage(storageKey));
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [storageKey, eventName]);

  return lastSync;
}
