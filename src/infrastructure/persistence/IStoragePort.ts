/**
 * Port para persistência — compatível com Zustand persist (getItem/setItem/removeItem)
 * e com API de alto nível (save/load/delete).
 */
export interface IStoragePort {
  /** Persiste dados (serializa se não for string). */
  save(key: string, data: unknown): Promise<void>;
  /** Carrega e desserializa dados. */
  load<T>(key: string): Promise<T | null>;
  /** Remove item do storage. */
  delete(key: string): Promise<void>;

  /** Acesso raw para middleware (ex.: Zustand persist). Retorna string ou null. */
  getItem(key: string): Promise<string | null>;
  /** Escrita raw para middleware. */
  setItem(key: string, value: string): Promise<void>;
  /** Remove item (alias para delete para compatibilidade). */
  removeItem(key: string): Promise<void>;
}
