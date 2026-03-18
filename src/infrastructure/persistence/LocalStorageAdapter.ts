import type { IStoragePort } from "./IStoragePort";

const KEY_PREFIX = "structura_";

/**
 * Adapter de persistência usando localStorage.
 * Implementa IStoragePort e pode ser usado pelo middleware persist do Zustand.
 */
export class LocalStorageAdapter implements IStoragePort {
  /** When true, setItem/save become no-ops (used when FileSystem storage is active). */
  paused = false;

  constructor(private readonly prefix: string = KEY_PREFIX) {}

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  private fallbackKeys(k: string): string[] {
    const currentKey = this.key(k);
    const matches: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey || storageKey === currentKey) continue;
      if (storageKey.endsWith(k)) matches.push(storageKey);
    }

    return matches;
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
    } catch {
      // localStorage pode estar cheio ou indisponível (privado, etc.)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.key(key));
      this.fallbackKeys(key).forEach((fallbackKey) => {
        localStorage.removeItem(fallbackKey);
      });
    } catch {
      // ignore
    }
  }

  async save(key: string, data: unknown): Promise<void> {
    const value =
      typeof data === "string" ? data : JSON.stringify(data);
    await this.setItem(key, value);
  }

  /**
   * Write data to localStorage even when paused (e.g. backup from memory before disconnecting file system).
   */
  async forceSave(key: string, data: unknown): Promise<void> {
    const value =
      typeof data === "string" ? data : JSON.stringify(data);
    try {
      localStorage.setItem(this.key(key), value);
    } catch {
      // localStorage pode estar cheio ou indisponível
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
}

/** Instância singleton para uso na aplicação. */
export const defaultStorage = new LocalStorageAdapter();
