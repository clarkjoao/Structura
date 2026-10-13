import type { IStoragePort } from "./IStoragePort";

const KEY_PREFIX = "structura_";

/**
 * `IStoragePort` over the browser's `sessionStorage`: values last for the tab's
 * session and are gone once it closes. For secrets the user did not ask to
 * keep, e.g. MCP tokens without "Remember on this browser". Same contract as
 * the local adapter; only the lifetime differs.
 */
export class SessionStorageAdapter implements IStoragePort {
  constructor(private readonly prefix: string = KEY_PREFIX) {}

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  private get store(): Storage | null {
    try {
      return globalThis.sessionStorage ?? null;
    } catch {
      // Blocked storage (privacy settings) throws on access.
      return null;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return this.store?.getItem(this.key(key)) ?? null;
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const store = this.store;
    if (!store) throw new Error("sessionStorage is not available");
    store.setItem(this.key(key), value);
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.store?.removeItem(this.key(key));
    } catch (error) {
      console.warn("[Structura] SessionStorageAdapter removeItem", error);
    }
  }

  async save(key: string, data: unknown): Promise<void> {
    await this.setItem(key, typeof data === "string" ? data : JSON.stringify(data));
  }

  async load<T>(key: string): Promise<T | null> {
    const value = await this.getItem(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async delete(key: string): Promise<void> {
    await this.removeItem(key);
  }

  async keys(): Promise<string[]> {
    const store = this.store;
    if (!store) return [];
    const result: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const storageKey = store.key(index);
      if (storageKey?.startsWith(this.prefix)) result.push(storageKey.slice(this.prefix.length));
    }
    return result;
  }

  async length(): Promise<number> {
    return (await this.keys()).length;
  }
}

/** The app's session-scoped storage. */
export const sessionStorageAdapter = new SessionStorageAdapter();
