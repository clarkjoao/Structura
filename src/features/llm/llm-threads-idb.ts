import { migrateStoredMessages } from "./message-parts";
import type { ConversationThread, DiagramThreadState } from "./types";

const DB_NAME = "structura";
const THREADS_STORE = "llm_threads";
const SCHEMA_VERSION = 1;
const MIGRATION_FLAG_KEY = "structura:llm:history:migratedToIdb";

/**
 * Format of the thread state inside a record (not the IndexedDB schema, which
 * is `SCHEMA_VERSION`). 1 (or absent): messages carry `content: string`.
 * 2: messages carry `parts`. Records are migrated on read and rewritten at the
 * current format only once the migration succeeded.
 */
export const THREAD_FORMAT_VERSION = 2;

interface ThreadRecord {
  diagramId: string;
  state: DiagramThreadState;
  formatVersion?: number;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function isThreadRecord(value: unknown): value is ThreadRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { diagramId?: unknown; state?: unknown };
  return (
    typeof candidate.diagramId === "string" &&
    typeof candidate.state === "object" &&
    candidate.state !== null
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(THREADS_STORE)) {
        db.createObjectStore(THREADS_STORE, { keyPath: "diagramId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function readThreadRecord(
  db: IDBDatabase,
  diagramId: string,
): Promise<DiagramThreadState | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(THREADS_STORE, "readonly");
    const store = transaction.objectStore(THREADS_STORE);
    const request = store.get(diagramId);
    request.onsuccess = () => {
      const value: unknown = request.result;
      if (isThreadRecord(value)) {
        resolve(migrateThreadState(value.state).state);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("idb read failed"));
  });
}

async function writeThreadRecord(
  db: IDBDatabase,
  diagramId: string,
  state: DiagramThreadState,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(THREADS_STORE, "readwrite");
    const store = transaction.objectStore(THREADS_STORE);
    const record: ThreadRecord = { diagramId, state, formatVersion: THREAD_FORMAT_VERSION };
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("idb write failed"));
  });
}

async function readAllThreadRecords(db: IDBDatabase): Promise<ThreadRecord[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(THREADS_STORE, "readonly");
    const store = transaction.objectStore(THREADS_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const results: unknown[] = Array.isArray(request.result) ? request.result : [];
      resolve(results.filter(isThreadRecord));
    };
    request.onerror = () => reject(request.error ?? new Error("idb read-all failed"));
  });
}

/**
 * Read the persisted thread state for `diagramId`. Returns an empty state if
 * no record exists or IndexedDB is unavailable.
 *
 * Async because IndexedDB is async; the prior localStorage path was sync.
 */
export async function loadThreadsFromIdb(diagramId: string): Promise<DiagramThreadState> {
  if (!isIndexedDbAvailable()) {
    return { threads: [], activeThreadId: "" };
  }
  try {
    const db = await openDatabase();
    try {
      const state = await readThreadRecord(db, diagramId);
      return state ?? { threads: [], activeThreadId: "" };
    } finally {
      db.close();
    }
  } catch {
    return { threads: [], activeThreadId: "" };
  }
}

export async function saveThreadsToIdb(
  diagramId: string,
  state: DiagramThreadState,
): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }
  try {
    const db = await openDatabase();
    try {
      await writeThreadRecord(db, diagramId, state);
    } finally {
      db.close();
    }
  } catch {
    // Silent failure: persistence is best-effort. Surface via console for
    // diagnostics without bubbling into the UI (the in-memory store still
    // works).
    console.warn("[llm-threads-idb] Failed to persist threads");
  }
}

/**
 * One-shot migration from the legacy localStorage key
 * `structura:llm:history`. Idempotent: if the migration flag is already set,
 * this is a no-op even if the localStorage payload still exists. The flag is
 * set only after a successful IDB write of all entries.
 */
export async function migrateThreadsFromLocalStorageToIdb(
  legacyJson: string | null,
): Promise<boolean> {
  if (!isIndexedDbAvailable() || !legacyJson) {
    return false;
  }
  try {
    if (localStorage.getItem(MIGRATION_FLAG_KEY) === "1") {
      return false;
    }
    let legacy: unknown;
    try {
      legacy = JSON.parse(legacyJson);
    } catch {
      return false;
    }
    if (typeof legacy !== "object" || legacy === null) {
      return false;
    }

    const db = await openDatabase();
    try {
      const records: ThreadRecord[] = [];
      for (const [diagramId, value] of Object.entries(legacy)) {
        if (!isObject(value)) continue;
        const record: ThreadRecord = { diagramId, state: migrateThreadState(value).state };
        records.push(record);
      }
      for (const record of records) {
        await writeThreadRecord(db, record.diagramId, record.state);
      }
    } finally {
      db.close();
    }
    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Test-only helper. Clears the migration flag from localStorage. The IDB
 * itself is wiped by the test harness (which installs an in-memory mock and
 * can simply drop its stores between tests). Calling
 * `indexedDB.deleteDatabase(DB_NAME)` here would race with the mock's async
 * semantics and leave a fresh test running against a half-cleared store.
 */
export function resetThreadsIdbForTests(): void {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTimestamp(value: unknown): number {
  return typeof value === "number" ? value : Date.now();
}

function migrateThread(thread: Record<string, unknown>): {
  thread: ConversationThread;
  changed: boolean;
} {
  const { messages, changed } = migrateStoredMessages(thread.messages);
  return {
    thread: {
      id: String(thread.id ?? ""),
      diagramId: String(thread.diagramId ?? ""),
      title: String(thread.title ?? ""),
      messages,
      createdAt: readTimestamp(thread.createdAt),
      updatedAt: readTimestamp(thread.updatedAt),
    },
    changed,
  };
}

/**
 * Brings a stored `DiagramThreadState` to the current message format. Every
 * message is kept (see `migrateStoredMessage`); a thread entry that is not an
 * object is skipped, since there is no conversation to recover from it.
 * `changed` is false when the value was already in the current format.
 */
export function migrateThreadState(value: unknown): {
  state: DiagramThreadState;
  changed: boolean;
} {
  if (!isObject(value) || !Array.isArray(value.threads)) {
    return { state: { threads: [], activeThreadId: "" }, changed: true };
  }
  let changed = false;
  const threads: ConversationThread[] = [];
  for (const raw of value.threads) {
    if (!isObject(raw)) {
      changed = true;
      continue;
    }
    const migrated = migrateThread(raw);
    if (migrated.changed) changed = true;
    threads.push(migrated.thread);
  }
  const activeThreadId = typeof value.activeThreadId === "string" ? value.activeThreadId : "";
  return { state: { threads, activeThreadId }, changed };
}

/**
 * Read every persisted thread record. Used by the migration step and by tests.
 * The result is an in-memory snapshot — does not hold the DB open across calls.
 */
export async function loadAllThreadsFromIdb(): Promise<Record<string, DiagramThreadState>> {
  if (!isIndexedDbAvailable()) {
    return {};
  }
  try {
    const db = await openDatabase();
    try {
      const records = await readAllThreadRecords(db);
      const result: Record<string, DiagramThreadState> = {};
      const toRewrite: Array<{ diagramId: string; state: DiagramThreadState }> = [];
      for (const record of records) {
        // One bad record must not cost the user every other diagram's history.
        try {
          const { state, changed } = migrateThreadState(record.state);
          result[record.diagramId] = state;
          if (changed || record.formatVersion !== THREAD_FORMAT_VERSION) {
            toRewrite.push({ diagramId: record.diagramId, state });
          }
        } catch (error) {
          console.warn(`[llm-threads-idb] Skipped unreadable record ${record.diagramId}`, error);
        }
      }
      for (const { diagramId, state } of toRewrite) {
        try {
          await writeThreadRecord(db, diagramId, state);
        } catch {
          // The migrated state is still served from memory; the next save
          // writes it in the current format.
          console.warn(`[llm-threads-idb] Failed to rewrite record ${diagramId}`);
        }
      }
      return result;
    } finally {
      db.close();
    }
  } catch {
    return {};
  }
}
