import type { IStoragePort } from "./IStoragePort";


export class InMemoryAdapter implements IStoragePort {
  private readonly store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async save(key: string, data: unknown): Promise<void> {
    const value = typeof data === "string" ? data : JSON.stringify(data);
    this.store.set(key, value);
  }

  async load<T>(key: string): Promise<T | null> {
    const s = this.store.get(key);
    if (s === undefined) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return s as T;
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
