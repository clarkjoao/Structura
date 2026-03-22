/**
 * Persistence port: Zustand `persist` primitives (`getItem` / `setItem` / `removeItem`)
 * plus higher-level `save` / `load` / `delete`.
 */
export interface IStoragePort {
  /** Persist value (JSON-serialize when not already a string). */
  save(key: string, data: unknown): Promise<void>;
  /** Load and parse stored JSON (or return raw string). */
  load<T>(key: string): Promise<T | null>;
  /** Remove stored entry. */
  delete(key: string): Promise<void>;

  /** Raw read for middleware (e.g. Zustand persist). */
  getItem(key: string): Promise<string | null>;
  /** Raw write for middleware. */
  setItem(key: string, value: string): Promise<void>;
  /** Raw delete (same as `delete`). */
  removeItem(key: string): Promise<void>;
}
