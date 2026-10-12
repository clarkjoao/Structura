import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  THREAD_FORMAT_VERSION,
  loadAllThreadsFromIdb,
  loadThreadsFromIdb,
  migrateThreadsFromLocalStorageToIdb,
  resetThreadsIdbForTests,
  saveThreadsToIdb,
} from "./llm-threads-idb";
import type { DiagramThreadState } from "./types";

// ---------------------------------------------------------------------------
// Minimal in-memory mock for the platform `indexedDB`.
// Supports: open / transaction / objectStore / get / put / getAll / delete.
// Installed per-test by `installIndexedDbMock()`, restored by the afterEach.
// ---------------------------------------------------------------------------

interface FakeObjectStore {
  name: string;
  data: Map<string, unknown>;
  get(key: string): FakeRequest<unknown>;
  put(record: unknown): FakeRequest<IDBValidKey>;
  getAll(): FakeRequest<unknown[]>;
  delete(key: string): FakeRequest<undefined>;
}

interface FakeTransaction {
  objectStore(name: string): FakeObjectStore;
  oncomplete: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onabort: ((event: unknown) => void) | null;
  mode: "readonly" | "readwrite";
}

interface FakeDb {
  objectStoreNames: { contains(name: string): boolean };
  transaction(name: string, mode: "readonly" | "readwrite"): FakeTransaction;
  createObjectStore(name: string, options?: { keyPath?: string }): FakeObjectStore;
  close(): void;
}

interface FakeRequest<T> {
  result: T;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onupgradeneeded: ((event: unknown) => void) | null;
  error: Error | null;
}

function makeRequest<T>(invoke: () => { result: T; error?: Error }): FakeRequest<T> {
  const request: FakeRequest<T> = {
    result: undefined as unknown as T,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    error: null,
  };
  // Defer to next microtask to mimic IDB's async semantics.
  Promise.resolve()
    .then(() => {
      const { result, error } = invoke();
      request.result = result;
      if (error) {
        request.error = error;
        request.onerror?.(null);
      } else {
        request.onsuccess?.(null);
      }
    })
    .catch(() => {});
  return request;
}

function installIndexedDbMock(): { stores: Map<string, FakeObjectStore> } {
  const stores = new Map<string, FakeObjectStore>();

  const makeDb = (): FakeDb => {
    const db: FakeDb = {
      objectStoreNames: {
        contains(name) {
          return stores.has(name);
        },
      },
      transaction(name, mode) {
        const store = stores.get(name);
        if (!store) {
          throw new Error(`Object store ${name} not found`);
        }
        const transaction: FakeTransaction = {
          mode,
          objectStore(_storeName) {
            return store;
          },
          oncomplete: null,
          onerror: null,
          onabort: null,
        };
        // Fire oncomplete after the queue settles — mirror IDB.
        Promise.resolve().then(() => {
          transaction.oncomplete?.(null);
        });
        return transaction;
      },
      createObjectStore(name) {
        const store: FakeObjectStore = {
          name,
          data: new Map(),
          get(key) {
            return makeRequest(() => ({ result: store.data.get(key) }));
          },
          put(record) {
            return makeRequest(() => {
              const recordObj = record as { diagramId?: unknown };
              const key = typeof recordObj?.diagramId === "string" ? recordObj.diagramId : "";
              store.data.set(key, record);
              return { result: key };
            });
          },
          getAll() {
            return makeRequest(() => ({ result: Array.from(store.data.values()) }));
          },
          delete(key) {
            return makeRequest(() => {
              store.data.delete(key);
              return { result: undefined };
            });
          },
        };
        stores.set(name, store);
        return store;
      },
      close() {},
    };
    return db;
  };

  const fakeIndexedDb = {
    open(_name: string, _version: number) {
      return makeRequest(() => {
        // Ensure default store exists on first open (mimics upgrade).
        if (!stores.has("llm_threads")) {
          stores.set("llm_threads", {
            name: "llm_threads",
            data: new Map(),
            get(key) {
              return makeRequest(() => ({ result: stores.get("llm_threads")!.data.get(key) }));
            },
            put(record) {
              return makeRequest(() => {
                const recordObj = record as { diagramId?: unknown };
                const key = typeof recordObj?.diagramId === "string" ? recordObj.diagramId : "";
                stores.get("llm_threads")!.data.set(key, record);
                return { result: key };
              });
            },
            getAll() {
              return makeRequest(() => ({
                result: Array.from(stores.get("llm_threads")!.data.values()),
              }));
            },
            delete(key) {
              return makeRequest(() => {
                stores.get("llm_threads")!.data.delete(key);
                return { result: undefined };
              });
            },
          });
        }
        return { result: makeDb() };
      });
    },
    deleteDatabase(_name: string) {
      return makeRequest(() => {
        stores.clear();
        return { result: undefined };
      });
    },
  };

  Object.defineProperty(globalThis, "indexedDB", {
    value: fakeIndexedDb,
    configurable: true,
    writable: true,
  });

  return { stores };
}

function uninstallIndexedDbMock(): void {
  Object.defineProperty(globalThis, "indexedDB", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

function makeState(diagramId: string): DiagramThreadState {
  return {
    threads: [
      {
        id: `t-${diagramId}`,
        diagramId,
        title: `Title ${diagramId}`,
        messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }], timestamp: 1 }],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    activeThreadId: `t-${diagramId}`,
  };
}

beforeEach(() => {
  localStorage.clear();
  resetThreadsIdbForTests();
  uninstallIndexedDbMock();
});

afterEach(() => {
  resetThreadsIdbForTests();
  uninstallIndexedDbMock();
});

describe("llm-threads-idb", () => {
  it("round-trips a DiagramThreadState through IDB", async () => {
    installIndexedDbMock();
    const diagramId = "diagram-rt";
    const state = makeState(diagramId);
    await saveThreadsToIdb(diagramId, state);
    const loaded = await loadThreadsFromIdb(diagramId);
    expect(loaded.threads[0]?.id).toBe(state.threads[0]?.id);
    expect(loaded.activeThreadId).toBe(state.activeThreadId);
  });

  it("returns empty state for a diagram that was never written", async () => {
    installIndexedDbMock();
    const loaded = await loadThreadsFromIdb("diagram-missing");
    expect(loaded).toEqual({ threads: [], activeThreadId: "" });
  });

  it("loadAllThreadsFromIdb returns every persisted record", async () => {
    installIndexedDbMock();
    await saveThreadsToIdb("a", makeState("a"));
    await saveThreadsToIdb("b", makeState("b"));
    const all = await loadAllThreadsFromIdb();
    expect(Object.keys(all).sort()).toEqual(["a", "b"]);
    expect(all["a"]?.threads[0]?.id).toBe("t-a");
  });

  it("migrates a legacy localStorage payload into IDB on first run", async () => {
    installIndexedDbMock();
    const legacy = JSON.stringify({
      "diagram-legacy": {
        threads: [
          {
            id: "legacy-1",
            diagramId: "diagram-legacy",
            title: "Legacy",
            messages: [{ id: "lm", role: "user", content: "old", timestamp: 1 }],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        activeThreadId: "legacy-1",
      },
    });
    localStorage.setItem("structura:llm:history", legacy);
    const migrated = await migrateThreadsFromLocalStorageToIdb(legacy);
    expect(migrated).toBe(true);
    expect(localStorage.getItem("structura:llm:history:migratedToIdb")).toBe("1");
    const loaded = await loadThreadsFromIdb("diagram-legacy");
    expect(loaded.threads[0]?.title).toBe("Legacy");
  });

  it("migration is idempotent on the second call (flag set)", async () => {
    installIndexedDbMock();
    localStorage.setItem("structura:llm:history:migratedToIdb", "1");
    const legacy = JSON.stringify({
      "diagram-again": {
        threads: [],
        activeThreadId: "",
      },
    });
    const migrated = await migrateThreadsFromLocalStorageToIdb(legacy);
    expect(migrated).toBe(false);
    const loaded = await loadAllThreadsFromIdb();
    expect(Object.keys(loaded)).toEqual([]);
  });

  it("migration is a no-op when legacy payload is empty", async () => {
    installIndexedDbMock();
    const migrated = await migrateThreadsFromLocalStorageToIdb(null);
    expect(migrated).toBe(false);
    expect(localStorage.getItem("structura:llm:history:migratedToIdb")).toBeNull();
  });

  it("falls back gracefully when IndexedDB is undefined (Safari Private)", async () => {
    uninstallIndexedDbMock();
    // loadThreadsFromIdb returns empty rather than throwing.
    await expect(loadThreadsFromIdb("any")).resolves.toEqual({
      threads: [],
      activeThreadId: "",
    });
    // saveThreadsToIdb is a silent no-op.
    await expect(saveThreadsToIdb("any", makeState("any"))).resolves.toBeUndefined();
    // loadAllThreadsFromIdb returns {}.
    await expect(loadAllThreadsFromIdb()).resolves.toEqual({});
  });

  it("resetThreadsIdbForTests clears stores and the migration flag", async () => {
    installIndexedDbMock();
    await saveThreadsToIdb("diag", makeState("diag"));
    localStorage.setItem("structura:llm:history:migratedToIdb", "1");
    resetThreadsIdbForTests();
    // The flag is removed even if no IDB is reachable.
    expect(localStorage.getItem("structura:llm:history:migratedToIdb")).toBeNull();
  });
});

describe("llm-threads-idb — message parts migration", () => {
  async function seed(records: Array<[string, unknown]>): Promise<Map<string, unknown>> {
    const { stores } = installIndexedDbMock();
    // Opens the database so the object store exists, then writes raw records.
    await saveThreadsToIdb("__seed__", makeState("__seed__"));
    const data = stores.get("llm_threads")!.data;
    data.delete("__seed__");
    for (const [key, value] of records) {
      data.set(key, value);
    }
    return data;
  }

  const legacyRecord = {
    diagramId: "legacy",
    state: {
      threads: [
        {
          id: "t1",
          diagramId: "legacy",
          title: "Old",
          messages: [
            { id: "u", role: "user", content: "Add a cache", timestamp: 1 },
            { id: "a", role: "assistant", content: "Done", timestamp: 2 },
          ],
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      activeThreadId: "t1",
    },
  };

  it("migrates a legacy record to parts and rewrites it at the current format", async () => {
    const data = await seed([["legacy", legacyRecord]]);
    const all = await loadAllThreadsFromIdb();
    expect(all["legacy"]?.threads[0]?.messages).toEqual([
      { id: "u", role: "user", parts: [{ type: "text", text: "Add a cache" }], timestamp: 1 },
      { id: "a", role: "assistant", parts: [{ type: "text", text: "Done" }], timestamp: 2 },
    ]);
    const rewritten = data.get("legacy") as { formatVersion?: number; state: unknown };
    expect(rewritten.formatVersion).toBe(THREAD_FORMAT_VERSION);
    expect(rewritten.state).toEqual(all["legacy"]);
  });

  it("leaves an already-migrated record unchanged", async () => {
    const current = {
      diagramId: "current",
      formatVersion: THREAD_FORMAT_VERSION,
      state: makeState("current"),
    };
    const data = await seed([["current", current]]);
    const all = await loadAllThreadsFromIdb();
    expect(all["current"]).toEqual(current.state);
    expect(data.get("current")).toBe(current);
  });

  it("is idempotent: a second load sees the same migrated state", async () => {
    await seed([["legacy", legacyRecord]]);
    const first = await loadAllThreadsFromIdb();
    const second = await loadAllThreadsFromIdb();
    expect(second).toEqual(first);
  });

  it("a corrupt entry does not break loading the rest", async () => {
    await seed([
      ["legacy", legacyRecord],
      ["broken", { diagramId: "broken", state: { threads: "not-an-array" } }],
      ["garbage", 42],
    ]);
    const all = await loadAllThreadsFromIdb();
    expect(all["legacy"]?.threads).toHaveLength(1);
    expect(all["broken"]).toEqual({ threads: [], activeThreadId: "" });
    expect(all["garbage"]).toBeUndefined();
  });
});
