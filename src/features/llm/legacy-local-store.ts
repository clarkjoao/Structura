import { LocalStorageAdapter, type IStoragePort } from "@/infrastructure/persistence";

/**
 * The browser storage under the key names the chat used before it went
 * through the storage port. Unprefixed, so the old keys are read (and, after
 * a migration, deleted) exactly as they were written.
 */
export const legacyLocalStore: IStoragePort = new LocalStorageAdapter("");
