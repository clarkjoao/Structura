import { isQuotaExceededError } from "./storageQuota";

/*
 * The unload rescue: IndexedDB cannot write synchronously, so on `pagehide`
 * the pending workspace is also written here, synchronously, and the next
 * start adopts it if it is newer than the IndexedDB record
 * (bootWorkspaceStorage). It lives for one page load.
 */

interface Rescue {
  savedAt: number;
  value: string;
}

function rescueKey(key: string): string {
  return `structura_${key}:rescue`;
}

function isRescue(value: unknown): value is Rescue {
  if (typeof value !== "object" || value === null) return false;
  const candidate: { savedAt?: unknown; value?: unknown } = value;
  return typeof candidate.savedAt === "number" && typeof candidate.value === "string";
}

export function readRescue(key: string): Rescue | null {
  try {
    const raw = localStorage.getItem(rescueKey(key));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRescue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** False when it does not fit (or localStorage is unavailable); never throws. */
export function writeRescue(key: string, value: string, savedAt: number): boolean {
  try {
    const rescue: Rescue = { savedAt, value };
    localStorage.setItem(rescueKey(key), JSON.stringify(rescue));
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) console.warn("[Structura] unload rescue failed", error);
    return false;
  }
}

export function removeRescue(key: string): void {
  try {
    localStorage.removeItem(rescueKey(key));
  } catch {
    // Nothing to do: a leftover rescue older than the record is dropped at the next start.
  }
}
