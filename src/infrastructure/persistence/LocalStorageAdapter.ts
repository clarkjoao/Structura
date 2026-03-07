import type { IStoragePort } from "./IStoragePort";

const KEY_PREFIX = "archflow_";

/**
 * Adapter de persistência usando localStorage.
 * Implementa IStoragePort e pode ser usado pelo middleware persist do Zustand.
 */
export class LocalStorageAdapter implements IStoragePort {
  constructor(private readonly prefix: string = KEY_PREFIX) {}

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(this.key(key));
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(this.key(key), value);
    } catch {
      // localStorage pode estar cheio ou indisponível (privado, etc.)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.key(key));
    } catch {
      // ignore
    }
  }

  async save(key: string, data: unknown): Promise<void> {
    const value =
      typeof data === "string" ? data : JSON.stringify(data);
    await this.setItem(key, value);
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
