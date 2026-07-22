export interface IStoragePort {
  save(key: string, data: unknown): Promise<void>;

  load<T>(key: string): Promise<T | null>;

  delete(key: string): Promise<void>;

  getItem(key: string): Promise<string | null>;

  setItem(key: string, value: string): Promise<void>;

  removeItem(key: string): Promise<void>;

  /**
   * Returns all keys managed by this adapter.
   * Returns keys without the adapter's namespace prefix.
   */
  keys(): Promise<string[]>;

  /**
   * Returns the number of keys managed by this adapter.
   */
  length(): Promise<number>;
}
