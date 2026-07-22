import type { IStoragePort } from "./IStoragePort";
import { isQuotaExceededError } from "./storageQuota";

const KEY_PREFIX = "structura_";

export class LocalStorageAdapter implements IStoragePort {
  paused = false;

  constructor(private readonly prefix: string = KEY_PREFIX) {}

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  private lastStorageLength = -1;

  private readonly fallbackKeysMemo = new Map<string, string[]>();

  private invalidateFallbackKeyMemo(): void {
    this.lastStorageLength = -1;
    this.fallbackKeysMemo.clear();
  }

  private computeFallbackKeys(k: string): string[] {
    const currentKey = this.key(k);
    const matches: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey || storageKey === currentKey) continue;
      if (storageKey.endsWith(k)) matches.push(storageKey);
    }

    return matches;
  }

  private fallbackKeys(k: string): string[] {
    const length = localStorage.length;
    if (length !== this.lastStorageLength) {
      this.fallbackKeysMemo.clear();
      this.lastStorageLength = length;
    }

    const memo = this.fallbackKeysMemo.get(k);
    if (memo !== undefined) {
      return memo;
    }

    const computed = this.computeFallbackKeys(k);
    this.fallbackKeysMemo.set(k, computed);
    return computed;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const currentValue = localStorage.getItem(this.key(key));
      if (currentValue !== null) return currentValue;

      for (const fallbackKey of this.fallbackKeys(key)) {
        const fallbackValue = localStorage.getItem(fallbackKey);
        if (fallbackValue !== null) return fallbackValue;
      }

      return null;
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.paused) return;
    try {
      localStorage.setItem(this.key(key), value);
      this.invalidateFallbackKeyMemo();
    } catch (error) {
      if (isQuotaExceededError(error)) {
        throw error;
      }
      console.warn("[Structura] LocalStorageAdapter setItem", error);
      throw error;
    }
  }

  /**
   * Same as {@link setItem} but synchronous. Use from `beforeunload` where async
   * persistence may not complete before the tab closes.
   */
  setItemSync(key: string, value: string): void {
    if (this.paused) return;
    localStorage.setItem(this.key(key), value);
    this.invalidateFallbackKeyMemo();
  }

  /**
   * Keys that already include the app namespace (e.g. sync timestamps). Not prefixed.
   * Does not honor {@link paused} — only call after a successful write you are attributing.
   */
  setAuxiliaryValue(fullKey: string, value: string): void {
    try {
      localStorage.setItem(fullKey, value);
      this.invalidateFallbackKeyMemo();
    } catch (error) {
      if (isQuotaExceededError(error)) {
        throw error;
      }
      console.warn("[Structura] LocalStorageAdapter setAuxiliaryValue", error);
      throw error;
    }
  }

  removeAuxiliaryKey(fullKey: string): void {
    try {
      localStorage.removeItem(fullKey);
      this.invalidateFallbackKeyMemo();
    } catch (error) {
      console.warn("[Structura] LocalStorageAdapter removeAuxiliaryKey", error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.key(key));
      this.fallbackKeys(key).forEach((fallbackKey) => {
        localStorage.removeItem(fallbackKey);
      });
      this.invalidateFallbackKeyMemo();
    } catch (error) {
      console.warn("[StructuraContext] LocalStorageAdapter removeItem", error);
    }
  }

  async save(key: string, data: unknown): Promise<void> {
    const value = typeof data === "string" ? data : JSON.stringify(data);
    await this.setItem(key, value);
  }

  async forceSave(key: string, data: unknown): Promise<boolean> {
    const value = typeof data === "string" ? data : JSON.stringify(data);
    try {
      localStorage.setItem(this.key(key), value);
      this.invalidateFallbackKeyMemo();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Same as {@link forceSave} but synchronous; for `beforeunload` where async cannot complete.
   * Ignores {@link paused} (matches force-save semantics).
   */
  forceSaveSync(key: string, data: unknown): boolean {
    const value = typeof data === "string" ? data : JSON.stringify(data);
    try {
      localStorage.setItem(this.key(key), value);
      this.invalidateFallbackKeyMemo();
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
    const result: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (storageKey?.startsWith(this.prefix)) {
        result.push(storageKey.slice(this.prefix.length));
      }
    }
    return result;
  }

  async length(): Promise<number> {
    return localStorage.length;
  }
}

export const defaultStorage = new LocalStorageAdapter();
