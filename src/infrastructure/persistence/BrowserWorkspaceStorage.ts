import type { IStoragePort } from "./IStoragePort";

/**
 * The browser copy of the workspace (`LocalStorageAdapter` or `IndexedDbAdapter`):
 * the port plus what folder sync needs from it — pausing ordinary writes while a
 * folder owns the workspace, writing through that pause, and the small
 * timestamp keys that always live in `localStorage`.
 */
export interface BrowserWorkspaceStorage extends IStoragePort {
  /** While true, `setItem`/`save` are no-ops; `forceSave` still writes. */
  paused: boolean;

  /** Writes even when {@link paused}; resolves false instead of throwing. */
  forceSave(key: string, data: unknown): Promise<boolean>;

  /** Writes a key that already carries the app namespace; not prefixed, ignores {@link paused}. */
  setAuxiliaryValue(fullKey: string, value: string): void;

  removeAuxiliaryKey(fullKey: string): void;
}

export function isBrowserWorkspaceStorage(
  storage: IStoragePort,
): storage is BrowserWorkspaceStorage {
  return "paused" in storage && "forceSave" in storage && "setAuxiliaryValue" in storage;
}
