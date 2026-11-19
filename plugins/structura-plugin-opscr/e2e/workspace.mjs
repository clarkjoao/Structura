/**
 * The workspace the app saved, for the e2e scripts. The app keeps it in IndexedDB and moves a
 * localStorage workspace into it on start (then removes the localStorage copy), so a script seeds
 * through localStorage once and reads back from IndexedDB — the same as cypress/support/
 * workspace-storage.ts does for the Cypress specs.
 */

export const STORE_KEY = "structura_diagram-store";
/** Set by the app once the workspace lives in IndexedDB: a seed written after it is ignored. */
export const MIGRATED_MARKER = "structura:workspaceInIndexedDb";

/** In the page: the saved workspace JSON, from IndexedDB, else localStorage, else null. */
function readSaved() {
  const fromLocal = () => localStorage.getItem("structura_diagram-store");
  return new Promise((resolve) => {
    if (!indexedDB) return resolve(fromLocal());
    const open = indexedDB.open("structura-workspace");
    open.onerror = () => resolve(fromLocal());
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.close();
        return resolve(fromLocal());
      }
      const get = db.transaction("kv").objectStore("kv").get("diagram-store");
      get.onsuccess = () => {
        db.close();
        const value = get.result?.value;
        resolve(typeof value === "string" ? value : fromLocal());
      };
      get.onerror = () => {
        db.close();
        resolve(fromLocal());
      };
    };
  });
}

/** The saved workspace state (`{ diagrams, ... }`), or null before the first save. */
export async function savedWorkspace(page) {
  const raw = await page.evaluate(readSaved);
  return raw ? JSON.parse(raw).state : null;
}
