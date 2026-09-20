import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { sidecarFileName, sidecarIdFromFileName } from "./sidecarFiles";
import type { SidecarScanEntry } from "./FileSystemAdapter";

/** Matches the store-level persist debounce, so the two settle together. */
const DEFAULT_DEBOUNCE_MS = 800;

/** Anything with an id and a last-touched time. */
export interface SidecarItem {
  id: string;
  updatedAt: number;
}

/** The workspace-side half of the adapter, narrowed to what this engine uses. */
export interface SidecarHost {
  readonly isConnected: boolean;
  readonly folderName: string | null;
  checkPermission(): Promise<boolean>;
  resolveSegmentsForFolder(folderId: string | null | undefined): string[];
  writeSidecar(segments: string[], fileName: string, data: unknown): Promise<boolean>;
  deleteSidecarAtSegments(segments: string[], fileName: string): Promise<boolean>;
  scanSidecars(suffix: string): Promise<SidecarScanEntry[]>;
}

export interface SidecarSyncOptions<T extends SidecarItem> {
  /** The file suffix this sync owns, e.g. `".walkthrough.json"`. */
  suffix: string;
  host: SidecarHost;
  /** Everything currently held in memory, by id. */
  getItems: () => Record<string, T>;
  /** Called when the engine decides the in-memory set must change. */
  replaceItems: (next: Record<string, T>) => void | Promise<void>;
  /** Fires whenever the items change; returns an unsubscribe. */
  subscribe: (onChange: () => void) => () => void;
  folderIdOf: (item: T) => string | null | undefined;
  toFile: (item: T) => unknown;
  /** Returns null when the file is not something this sync recognises. */
  fromFile: (raw: unknown) => T | null;
  debounceMs?: number;
}

export interface SidecarSync {
  /** Reconcile what is on disk with what is held in memory. */
  hydrate(): Promise<void>;
  /** Write out anything that changed. Normally driven by the subscription. */
  flush(): Promise<void>;
  /** Stop listening and cancel any pending flush. */
  stop(): void;
}

/**
 * Keeps a set of items mirrored as companion files in the connected workspace.
 *
 * Local storage stays the home of the items; the folder is a mirror, so
 * disconnecting never empties anything. What makes this more than a writer is
 * the record of which ids have been written to *this* workspace: without it,
 * "not on disk" is ambiguous between "new here" and "you deleted it", and the
 * only available behaviours are resurrecting deleted files or wiping the
 * library the first time a fresh folder is connected. See {@link hydrate}.
 */
export function createSidecarSync<T extends SidecarItem>(
  options: SidecarSyncOptions<T>,
): SidecarSync {
  const {
    suffix,
    host,
    getItems,
    replaceItems,
    subscribe,
    folderIdOf,
    toFile,
    fromFile,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const storage = new LocalStorageAdapter();

  /** Where each id was last written, so a move can delete the file it left. */
  let lastWrittenSegments: Record<string, string[]> = {};
  /** What was last written, so an unchanged item is not rewritten. */
  let lastWritten: Record<string, T> = {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let unsubscribe: (() => void) | null = null;

  /**
   * The synced-id record is per workspace: connecting a *different* folder must
   * never read as a mass deletion, so each folder keeps its own account of what
   * it has been told about.
   */
  function syncedIdsKey(): string | null {
    const workspace = host.folderName;
    if (!workspace) return null;
    return `sidecar_synced${suffix}:${workspace}`;
  }

  async function readSyncedIds(): Promise<Set<string>> {
    const key = syncedIdsKey();
    if (!key) return new Set();
    const stored = await storage.load<unknown>(key);
    if (!Array.isArray(stored)) return new Set();
    return new Set(stored.filter((id): id is string => typeof id === "string"));
  }

  async function writeSyncedIds(ids: ReadonlySet<string>): Promise<void> {
    const key = syncedIdsKey();
    if (!key) return;
    await storage.save(key, [...ids]);
  }

  function fileNameFor(id: string): string {
    return sidecarFileName(id, suffix);
  }

  function segmentsFor(item: T): string[] {
    return host.resolveSegmentsForFolder(folderIdOf(item));
  }

  function sameSegments(a: string[] | undefined, b: string[]): boolean {
    if (!a || a.length !== b.length) return false;
    return a.every((segment, i) => segment === b[i]);
  }

  async function doFlush(): Promise<void> {
    if (!host.isConnected) return;
    if (!(await host.checkPermission())) return;

    const items = getItems();
    const synced = await readSyncedIds();

    // Gone from memory → gone from disk, at wherever it was last written.
    for (const id of Object.keys(lastWritten)) {
      if (items[id]) continue;
      await host.deleteSidecarAtSegments(lastWrittenSegments[id] ?? [], fileNameFor(id));
      delete lastWritten[id];
      delete lastWrittenSegments[id];
      synced.delete(id);
    }

    for (const [id, item] of Object.entries(items)) {
      const segments = segmentsFor(item);
      const previous = lastWrittenSegments[id];
      const moved = previous !== undefined && !sameSegments(previous, segments);

      if (!moved && lastWritten[id] === item) continue;

      // A move is a delete at the old path and a write at the new one, so a
      // workspace never ends up holding two files for one item.
      if (moved) {
        await host.deleteSidecarAtSegments(previous, fileNameFor(id));
      }

      const wrote = await host.writeSidecar(segments, fileNameFor(id), toFile(item));
      if (!wrote) continue;

      lastWritten[id] = item;
      lastWrittenSegments[id] = segments;
      synced.add(id);
    }

    await writeSyncedIds(synced);
  }

  function scheduleFlush(): void {
    if (!host.isConnected) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      chain = chain.then(doFlush).catch((e) => {
        console.error("[sidecarSync] flush failed:", e);
      });
    }, debounceMs);
  }

  function isTombstone(raw: unknown): boolean {
    return (
      typeof raw === "object" && raw !== null && (raw as Record<string, unknown>).deleted === true
    );
  }

  // Listening starts with the engine; nothing is written until something
  // changes or `hydrate` is called.
  unsubscribe = subscribe(scheduleFlush);

  return {
    /**
     * Reconciles disk against memory. Three readings, and the third is the one
     * that makes deleting the files a real removal:
     *
     * | On disk | Synced here before | Reading                          |
     * | ------- | ------------------ | -------------------------------- |
     * | yes     | —                  | adopt; keep the newer `updatedAt` |
     * | no      | no                 | new local content → write it out |
     * | no      | yes                | the user deleted it → drop it    |
     *
     * A file that is there but unreadable counts as present. Absence is the
     * signal here, and "I could not read it" is not absence.
     */
    async hydrate(): Promise<void> {
      if (!host.isConnected) return;

      const found = await host.scanSidecars(suffix);
      const local = getItems();
      const synced = await readSyncedIds();

      const onDisk = new Set<string>();
      const next: Record<string, T> = { ...local };

      for (const entry of found) {
        onDisk.add(entry.id);
        if (entry.unreadable) continue;
        // A deletion marker means the file is gone in every sense but the byte.
        if (isTombstone(entry.raw)) {
          onDisk.delete(entry.id);
          continue;
        }

        const fromDisk = fromFile(entry.raw);
        if (!fromDisk) continue;

        const mine = local[fromDisk.id];
        if (!mine || fromDisk.updatedAt >= mine.updatedAt) {
          next[fromDisk.id] = fromDisk;
        }
        lastWritten[fromDisk.id] = next[fromDisk.id];
        lastWrittenSegments[fromDisk.id] = entry.segments;
      }

      for (const id of Object.keys(local)) {
        if (onDisk.has(id)) continue;
        if (synced.has(id)) {
          // Written here once, not here now: the user removed the file.
          delete next[id];
          delete lastWritten[id];
          delete lastWrittenSegments[id];
          synced.delete(id);
        }
        // Otherwise it is content this workspace has never been told about.
        // Leave it; the flush below writes it out.
      }

      await writeSyncedIds(synced);
      await replaceItems(next);
      await doFlush();
    },

    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      chain = chain.then(doFlush);
      await chain;
    },

    stop(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      unsubscribe?.();
      unsubscribe = null;
      lastWritten = {};
      lastWrittenSegments = {};
    },
  };
}

/** Exported for tests and for callers that need to read an id back off a name. */
export { sidecarIdFromFileName };
