import type { BrowserWorkspaceStorage } from "./BrowserWorkspaceStorage";
import { isQuotaExceededError } from "./storageQuota";

/*
 * The browser workspace in IndexedDB (ADR-0007): bounded by the origin quota
 * instead of localStorage's ~5 MB. Its own database, so the LLM threads store
 * (`structura`, llm-threads-idb.ts) keeps its own version. Values are the
 * strings the store already produces; each record carries when it was written,
 * which the boot compares with the unload rescue.
 */

export const WORKSPACE_DB_NAME = "structura-workspace";
const WORKSPACE_DB_VERSION = 1;
const STORE = "kv";

export interface WorkspaceRecord {
  value: string;
  savedAt: number;
}

function isWorkspaceRecord(value: unknown): value is WorkspaceRecord {
  if (typeof value !== "object" || value === null) return false;
  const record: { value?: unknown; savedAt?: unknown } = value;
  return typeof record.value === "string" && typeof record.savedAt === "number";
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** Resolves once the transaction is committed, so a write is durable when awaited. */
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
  });
}

export function openWorkspaceDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(WORKSPACE_DB_NAME, WORKSPACE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

export class IndexedDbAdapter implements BrowserWorkspaceStorage {
  paused = false;

  private db: IDBDatabase | null;

  private opening: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory,
    db?: IDBDatabase,
    private readonly now: () => number = Date.now,
  ) {
    this.db = db ? this.watch(db) : null;
  }

  /** Opens the database; rejects when IndexedDB cannot be used. */
  static async open(factory: IDBFactory, now?: () => number): Promise<IndexedDbAdapter> {
    return new IndexedDbAdapter(factory, await openWorkspaceDatabase(factory), now);
  }

  /** Let another connection delete or upgrade the database; the next call reopens. */
  private watch(db: IDBDatabase): IDBDatabase {
    db.onversionchange = () => {
      db.close();
      if (this.db === db) this.db = null;
    };
    return db;
  }

  private connection(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    this.opening ??= openWorkspaceDatabase(this.factory).then(
      (db) => {
        this.opening = null;
        this.db = this.watch(db);
        return db;
      },
      (error: unknown) => {
        this.opening = null;
        throw error;
      },
    );
    return this.opening;
  }

  async getRecord(key: string): Promise<WorkspaceRecord | null> {
    const db = await this.connection();
    const value: unknown = await requestResult(
      db.transaction(STORE, "readonly").objectStore(STORE).get(key),
    );
    return isWorkspaceRecord(value) ? value : null;
  }

  /** Writes `value` stamped with `savedAt` (now by default), ignoring {@link paused}. */
  async putRecord(key: string, value: string, savedAt: number = this.now()): Promise<void> {
    const db = await this.connection();
    const transaction = db.transaction(STORE, "readwrite");
    const record: WorkspaceRecord = { value, savedAt };
    transaction.objectStore(STORE).put(record, key);
    await transactionDone(transaction);
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return (await this.getRecord(key))?.value ?? null;
    } catch (error) {
      console.warn("[Structura] IndexedDbAdapter getItem", error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.paused) return;
    try {
      await this.putRecord(key, value);
    } catch (error) {
      if (!isQuotaExceededError(error)) console.warn("[Structura] IndexedDbAdapter setItem", error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.connection();
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(key);
      await transactionDone(transaction);
    } catch (error) {
      console.warn("[Structura] IndexedDbAdapter removeItem", error);
    }
  }

  async save(key: string, data: unknown): Promise<void> {
    await this.setItem(key, typeof data === "string" ? data : JSON.stringify(data));
  }

  async forceSave(key: string, data: unknown): Promise<boolean> {
    try {
      await this.putRecord(key, typeof data === "string" ? data : JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async load<T>(key: string): Promise<T | null> {
    const s = await this.getItem(key);
    if (s === null) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return s as T;
    }
  }

  async delete(key: string): Promise<void> {
    await this.removeItem(key);
  }

  async keys(): Promise<string[]> {
    const db = await this.connection();
    const keys = await requestResult(
      db.transaction(STORE, "readonly").objectStore(STORE).getAllKeys(),
    );
    return keys.filter((key): key is string => typeof key === "string");
  }

  async length(): Promise<number> {
    const db = await this.connection();
    return requestResult(db.transaction(STORE, "readonly").objectStore(STORE).count());
  }

  /** Small timestamp keys stay in localStorage, read synchronously by the UI. */
  setAuxiliaryValue(fullKey: string, value: string): void {
    localStorage.setItem(fullKey, value);
  }

  removeAuxiliaryKey(fullKey: string): void {
    try {
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.warn("[Structura] IndexedDbAdapter removeAuxiliaryKey", error);
    }
  }
}
