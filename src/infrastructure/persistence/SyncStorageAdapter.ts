import type { IStoragePort } from "./IStoragePort";

/**
 * Synchronous storage adapter that wraps IStoragePort operations.
 *
 * This exists because some consumers (notably llm-storage.ts) use synchronous
 * localStorage access for performance reasons - the LLM store is initialized at
 * boot time and synchronous access avoids async initialization complexity.
 *
 * Architecture note: AGENTS.md mandates "persistence goes through IStoragePort".
 * This adapter provides a bridge for sync access while eventually migrating
 * callers to async patterns. The sync access is an exception, not the rule.
 *
 * @deprecated Prefer async IStoragePort operations where possible. This adapter
 * is a temporary bridge for sync consumers that will be migrated in a future phase.
 */
export class SyncStorageAdapter {
  constructor(private readonly storage: IStoragePort) {}

  async getItem(key: string): Promise<string | null> {
    return this.storage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.storage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return this.storage.removeItem(key);
  }

  async save(key: string, data: unknown): Promise<void> {
    return this.storage.save(key, data);
  }

  async load<T>(key: string): Promise<T | null> {
    return this.storage.load<T>(key);
  }

  async delete(key: string): Promise<void> {
    return this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return this.storage.keys();
  }

  async length(): Promise<number> {
    return this.storage.length();
  }
}
