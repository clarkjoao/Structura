import type { StateStorage } from "zustand/middleware";

/**
 * Key-value preference storage: the one place outside the workspace port that
 * may touch `localStorage` / `sessionStorage` (enforced by ESLint). The workspace
 * itself goes through `IStoragePort`; everything small and non-workspace — user
 * preferences, caches, one-shot flags, integration secrets — goes through here.
 *
 * Every call is guarded: private mode, a disabled store or an exceeded quota
 * degrade to "nothing stored" instead of throwing into a render or an effect.
 * Keys are unchanged from the former direct calls, so no stored data is lost.
 */

function local(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function session(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function read(area: Storage | null, key: string): string | null {
  try {
    return area ? area.getItem(key) : null;
  } catch {
    return null;
  }
}

function write(area: Storage | null, key: string, value: string): boolean {
  try {
    if (!area) return false;
    area.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(area: Storage | null, key: string): void {
  try {
    area?.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}

function listKeys(area: Storage | null): string[] {
  try {
    if (!area) return [];
    const keys: string[] = [];
    for (let i = 0; i < area.length; i += 1) {
      const key = area.key(i);
      if (key !== null) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/** Reads a preference; `null` when absent or storage is unavailable. */
export const kvGetItem = (key: string): string | null => read(local(), key);

/** Writes a preference; returns false when it could not be stored (quota, private mode). */
export const kvSetItem = (key: string, value: string): boolean => write(local(), key, value);

export const kvRemoveItem = (key: string): void => remove(local(), key);

/** Snapshot of every key currently stored (for cache sweeps and usage measurement). */
export const kvKeys = (): string[] => listKeys(local());

/** Per-tab storage, for state that must die with the tab. */
export const kvSessionGetItem = (key: string): string | null => read(session(), key);
export const kvSessionSetItem = (key: string, value: string): boolean =>
  write(session(), key, value);
export const kvSessionRemoveItem = (key: string): void => remove(session(), key);

/**
 * Integration secrets (API tokens) are stored as plain preference values today,
 * exactly as before; these names exist so every secret read is findable and a
 * future change (encryption, session-only) has a single seam.
 */
export const readSecretItem = (key: string): string | null => kvGetItem(key);
export const writeSecretItem = (key: string, value: string): boolean => kvSetItem(key, value);
export const removeSecretItem = (key: string): void => kvRemoveItem(key);

/** A zustand `StateStorage` over the guarded store, for `persist(createJSONStorage(...))`. */
export function createZustandStorage(): StateStorage {
  return {
    getItem: (name) => kvGetItem(name),
    setItem: (name, value) => {
      kvSetItem(name, value);
    },
    removeItem: (name) => kvRemoveItem(name),
  };
}
