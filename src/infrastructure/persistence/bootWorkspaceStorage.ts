import type { BrowserWorkspaceStorage } from "./BrowserWorkspaceStorage";
import { IndexedDbAdapter } from "./IndexedDbAdapter";
import type { LocalStorageAdapter } from "./LocalStorageAdapter";
import { readRescue, removeRescue } from "./workspaceRescue";

/*
 * Picks where the browser keeps the workspace for this session (ADR-0007,
 * openspec indexeddb-workspace-storage): IndexedDB when it opens, after moving
 * a localStorage workspace into it and adopting a newer unload rescue;
 * localStorage otherwise. Never deletes a copy it has not read back equal.
 */

const WORKSPACE_OPEN_TIMEOUT_MS = 3000;

/**
 * Set once a migration has completed. With both copies present it tells an
 * old-build tab's later save (marker set: keep both, use IndexedDB) from a
 * migration cut short (no marker: copy again from localStorage).
 */
export const WORKSPACE_MIGRATED_MARKER_KEY = "structura:workspaceInIndexedDb";

export interface BootWorkspaceOptions {
  /** `globalThis.indexedDB`; undefined where the browser has none. */
  factory: IDBFactory | undefined;
  local: LocalStorageAdapter;
  /** The workspace key, unprefixed (`diagram-store`). */
  key: string;
  timeoutMs?: number;
  now?: () => number;
}

export type WorkspaceBootOutcome =
  | "indexeddb"
  | "indexeddb-migrated"
  | "localstorage-no-indexeddb"
  | "localstorage-open-failed"
  | "localstorage-migration-failed";

export interface WorkspaceBootResult {
  storage: BrowserWorkspaceStorage;
  outcome: WorkspaceBootOutcome;
}

function openWithTimeout(
  factory: IDBFactory,
  timeoutMs: number,
  now: (() => number) | undefined,
): Promise<IndexedDbAdapter> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`IndexedDB did not open within ${timeoutMs} ms`));
    }, timeoutMs);
    IndexedDbAdapter.open(factory, now).then(
      (adapter) => {
        clearTimeout(timer);
        if (timedOut) adapter.close();
        else resolve(adapter);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Copies the localStorage workspace into IndexedDB; true once it reads back equal and is removed. */
async function moveLocalWorkspace(
  idb: IndexedDbAdapter,
  local: LocalStorageAdapter,
  key: string,
  source: string,
): Promise<boolean> {
  try {
    await idb.putRecord(key, source);
    const copy = await idb.getRecord(key);
    if (copy?.value !== source) {
      console.warn("[Structura] workspace copy to IndexedDB did not read back equal");
      await idb.removeItem(key);
      return false;
    }
  } catch (error) {
    console.warn("[Structura] workspace copy to IndexedDB failed", error);
    return false;
  }
  await local.removeItem(key);
  try {
    local.setAuxiliaryValue(WORKSPACE_MIGRATED_MARKER_KEY, "1");
  } catch {
    // The localStorage copy is already gone, so a later start has nothing to redo.
  }
  return true;
}

/** Writes a rescue newer than the stored record into IndexedDB, then drops it. */
async function adoptRescue(idb: IndexedDbAdapter, key: string): Promise<void> {
  const rescue = readRescue(key);
  if (!rescue) return;
  const record = await idb.getRecord(key);
  if (!record || rescue.savedAt > record.savedAt) {
    try {
      await idb.putRecord(key, rescue.value, rescue.savedAt);
    } catch (error) {
      console.warn("[Structura] could not adopt the unload rescue; kept for the next start", error);
      return;
    }
  }
  removeRescue(key);
}

export async function bootWorkspaceStorage(
  options: BootWorkspaceOptions,
): Promise<WorkspaceBootResult> {
  const { factory, local, key, timeoutMs = WORKSPACE_OPEN_TIMEOUT_MS, now } = options;
  if (!factory) return { storage: local, outcome: "localstorage-no-indexeddb" };

  let idb: IndexedDbAdapter;
  let stored: Awaited<ReturnType<IndexedDbAdapter["getRecord"]>>;
  try {
    idb = await openWithTimeout(factory, timeoutMs, now);
    stored = await idb.getRecord(key);
  } catch (error) {
    console.warn("[Structura] IndexedDB unavailable; the workspace stays in localStorage", error);
    return { storage: local, outcome: "localstorage-open-failed" };
  }

  let outcome: WorkspaceBootOutcome = "indexeddb";
  const legacy = await local.getItem(key);
  if (legacy !== null) {
    if (stored && localStorage.getItem(WORKSPACE_MIGRATED_MARKER_KEY) !== null) {
      console.warn(
        "[Structura] a workspace exists in both IndexedDB and localStorage; using IndexedDB, deleting neither",
      );
    } else if (await moveLocalWorkspace(idb, local, key, legacy)) {
      outcome = "indexeddb-migrated";
    } else {
      idb.close();
      return { storage: local, outcome: "localstorage-migration-failed" };
    }
  }

  await adoptRescue(idb, key);
  return { storage: idb, outcome };
}
