import { DIAGRAM_STORE_LOCAL_STORAGE_KEY } from "./seed-stress-diagram";

/*
 * The app keeps the workspace in IndexedDB (openspec
 * indexeddb-workspace-storage) and moves a localStorage workspace into it on
 * start. Specs seed by writing the workspace to localStorage, so a seed must
 * keep winning over what an earlier test left in IndexedDB (testIsolation is
 * off): writing the workspace key drops the IndexedDB copy and the migration
 * marker, and the next load migrates the seed. Without a seed, the workspace
 * carries over between tests, as it did in localStorage.
 */

const WORKSPACE_DB = "structura-workspace";
const MIGRATED_MARKER = "structura:workspaceInIndexedDb";

function dropIndexedDbWorkspace(win: Window, storage: Storage, remove: Storage["removeItem"]) {
  remove.call(storage, MIGRATED_MARKER);
  // Queued before any open the app makes later; an open connection is closed
  // by the app's `versionchange` handler.
  win.indexedDB?.deleteDatabase(WORKSPACE_DB);
}

export function installSeedsWinOverIndexedDb(): void {
  Cypress.on("window:before:load", (win) => {
    const proto = win.Storage.prototype;
    const setItem = proto.setItem;
    const removeItem = proto.removeItem;
    proto.setItem = function (key: string, value: string) {
      if (key === DIAGRAM_STORE_LOCAL_STORAGE_KEY) dropIndexedDbWorkspace(win, this, removeItem);
      setItem.call(this, key, value);
    };
  });
}

/** The saved workspace JSON: IndexedDB when the app moved it there, else localStorage. */
export function readSavedWorkspace(win: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const fromLocal = () => resolve(win.localStorage.getItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY));
    if (!win.indexedDB) return fromLocal();
    const open = win.indexedDB.open(WORKSPACE_DB);
    open.onerror = fromLocal;
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.close();
        return fromLocal();
      }
      const get = db.transaction("kv").objectStore("kv").get("diagram-store");
      get.onsuccess = () => {
        db.close();
        const record: unknown = get.result;
        const value =
          typeof record === "object" && record !== null && "value" in record ? record.value : null;
        if (typeof value === "string") resolve(value);
        else fromLocal();
      };
      get.onerror = () => {
        db.close();
        fromLocal();
      };
    };
  });
}
