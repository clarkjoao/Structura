import type { BrowserWorkspaceStorage } from "./BrowserWorkspaceStorage";
import type { IStoragePort } from "./IStoragePort";
import {
  bootWorkspaceStorage,
  type WorkspaceBootOutcome,
  type WorkspaceBootResult,
} from "./bootWorkspaceStorage";
import { IndexedDbAdapter } from "./IndexedDbAdapter";
import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { writeRescue } from "./workspaceRescue";

/**
 * The port the diagram workspace is persisted through. Its target is chosen
 * by {@link bootWorkspaceStorage} on first use — IndexedDB when available,
 * localStorage otherwise — and every call waits for that choice, so code that
 * runs before the boot (the store's hydration at import) reads the right copy.
 * Small keys stay on `defaultStorage` (localStorage).
 */
export class WorkspaceStorage implements IStoragePort, BrowserWorkspaceStorage {
  private target: BrowserWorkspaceStorage | null = null;

  private booting: Promise<WorkspaceBootResult> | null = null;

  private pausedFlag = false;

  constructor(
    private readonly local: LocalStorageAdapter,
    private readonly boot: () => Promise<WorkspaceBootResult>,
    private readonly now: () => number = Date.now,
  ) {}

  get paused(): boolean {
    return this.pausedFlag;
  }

  set paused(value: boolean) {
    this.pausedFlag = value;
    if (this.target) this.target.paused = value;
  }

  /** Runs the boot once; resolves with where the workspace lives for this session. */
  ready(): Promise<WorkspaceBootResult> {
    this.booting ??= this.boot().then((result) => {
      result.storage.paused = this.pausedFlag;
      this.target = result.storage;
      return result;
    });
    return this.booting;
  }

  /** The adapter in use, or null before the boot has finished. */
  get current(): BrowserWorkspaceStorage | null {
    return this.target;
  }

  /** Where the workspace lives this session; null before the boot has finished. */
  get location(): "indexeddb" | "localstorage" | null {
    if (!this.target) return null;
    return this.target instanceof IndexedDbAdapter ? "indexeddb" : "localstorage";
  }

  get outcome(): Promise<WorkspaceBootOutcome> {
    return this.ready().then((result) => result.outcome);
  }

  private async use(): Promise<BrowserWorkspaceStorage> {
    return (await this.ready()).storage;
  }

  async getItem(key: string): Promise<string | null> {
    return (await this.use()).getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await (await this.use()).setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await (await this.use()).removeItem(key);
  }

  async save(key: string, data: unknown): Promise<void> {
    await (await this.use()).save(key, data);
  }

  async load<T>(key: string): Promise<T | null> {
    return (await this.use()).load<T>(key);
  }

  async delete(key: string): Promise<void> {
    await (await this.use()).delete(key);
  }

  async keys(): Promise<string[]> {
    return (await this.use()).keys();
  }

  async length(): Promise<number> {
    return (await this.use()).length();
  }

  async forceSave(key: string, data: unknown): Promise<boolean> {
    return (await this.use()).forceSave(key, data);
  }

  setAuxiliaryValue(fullKey: string, value: string): void {
    this.local.setAuxiliaryValue(fullKey, value);
  }

  removeAuxiliaryKey(fullKey: string): void {
    this.local.removeAuxiliaryKey(fullKey);
  }

  /**
   * The last write before the page goes away, synchronously where possible:
   * localStorage directly; with IndexedDB, a best-effort put plus the
   * synchronous rescue the next start adopts. `force` writes through
   * {@link paused}. Before the boot has finished there is nothing hydrated to
   * save, so it writes nothing. Returns whether a synchronous copy was made.
   */
  writeOnLeave(key: string, value: string, options: { force?: boolean } = {}): boolean {
    const target = this.target;
    if (!target || (this.pausedFlag && !options.force)) return false;
    if (target instanceof LocalStorageAdapter) {
      return options.force
        ? target.forceSaveSync(key, value)
        : trySync(() => target.setItemSync(key, value));
    }
    const savedAt = this.now();
    if (target instanceof IndexedDbAdapter) {
      void target.putRecord(key, value, savedAt).catch((error: unknown) => {
        console.warn("[Structura] IndexedDB write on leave failed", error);
      });
    }
    return writeRescue(key, value, savedAt);
  }
}

function trySync(write: () => void): boolean {
  try {
    write();
    return true;
  } catch {
    return false;
  }
}

const local = new LocalStorageAdapter();

export const workspaceStorage = new WorkspaceStorage(local, () =>
  bootWorkspaceStorage({
    factory: typeof indexedDB === "undefined" ? undefined : indexedDB,
    local,
    key: "diagram-store",
  }),
);
