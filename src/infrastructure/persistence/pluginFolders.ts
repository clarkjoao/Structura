/**
 * Folders that plugins read and write, picked by the user and remembered per plugin and
 * binding id (plugin API `files:folder`).
 *
 * The directory handle never leaves this module: plugins get a facade over one folder's
 * top-level text files. Handles are kept in IndexedDB (they are structured-cloneable), the
 * same way the app's own connected folder is, and permission is re-verified on reopen —
 * which may prompt, so `open` belongs in a user gesture.
 */

const DB_NAME = "structura-plugin-folders";
const DB_STORE = "handles";

/** What the API hands a plugin for one folder. */
export interface PluginFolderAccess {
  /** The folder's name, for display. */
  name: string;
  /** Top-level file names, sorted. */
  list(): Promise<string[]>;
  /** Top-level files with their last-modified time (ms) and size, sorted by name. */
  stats(): Promise<Array<{ name: string; lastModified: number; size: number }>>;
  read(fileName: string): Promise<string>;
  write(fileName: string, text: string): Promise<void>;
}

/** Where handles are remembered; IndexedDB in the app, a Map in tests. */
export interface FolderHandleStore {
  get(key: string): Promise<FileSystemDirectoryHandle | null>;
  set(key: string, handle: FileSystemDirectoryHandle): Promise<void>;
  delete(key: string): Promise<void>;
}

type PermissionedHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

type DirectoryPicker = (options?: {
  mode?: "readwrite";
  id?: string;
}) => Promise<FileSystemDirectoryHandle>;

/** A plain file name inside the folder — never a path that could leave it. */
export function assertFileName(fileName: string): void {
  if (
    typeof fileName !== "string" ||
    fileName === "" ||
    fileName === "." ||
    fileName === ".." ||
    /[/\\]/.test(fileName) ||
    fileName.includes("\0")
  ) {
    throw new Error(`[plugins] "${String(fileName)}" is not a file name inside the folder.`);
  }
}

function access(handle: PermissionedHandle): PluginFolderAccess {
  return {
    name: handle.name,
    async list() {
      const names: string[] = [];
      if (!handle.entries) return names;
      for await (const [name, entry] of handle.entries()) {
        if (entry.kind === "file") names.push(name);
      }
      return names.sort();
    },
    async stats() {
      const names: string[] = [];
      if (handle.entries) {
        for await (const [name, entry] of handle.entries()) {
          if (entry.kind === "file") names.push(name);
        }
      }
      const stats = await Promise.all(
        names.sort().map(async (name) => {
          // A file removed between listing and reading is simply absent.
          const file = await (await handle.getFileHandle(name)).getFile().catch(() => null);
          return file ? { name, lastModified: file.lastModified, size: file.size } : null;
        }),
      );
      return stats.filter((s): s is NonNullable<typeof s> => s !== null);
    },
    async read(fileName) {
      assertFileName(fileName);
      const file = await (await handle.getFileHandle(fileName)).getFile();
      return file.text();
    },
    async write(fileName, text) {
      assertFileName(fileName);
      const writable = await (
        await handle.getFileHandle(fileName, { create: true })
      ).createWritable();
      await writable.write(text);
      await writable.close();
    },
  };
}

async function hasPermission(handle: PermissionedHandle): Promise<boolean> {
  const mode = { mode: "readwrite" as const };
  if (!handle.queryPermission) return true;
  if ((await handle.queryPermission(mode)) === "granted") return true;
  return (await handle.requestPermission?.(mode)) === "granted";
}

function indexedDbStore(): FolderHandleStore {
  // One connection for the store's life, opened on first use; a failed open is retried.
  let db: Promise<IDBDatabase> | undefined;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        db = undefined;
        reject(request.error);
      };
    }));
  const run = async <T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => IDBRequest<T>,
  ) => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const request = body(db.transaction(DB_STORE, mode).objectStore(DB_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  return {
    get: async (key) =>
      ((await run("readonly", (s) => s.get(key))) as FileSystemDirectoryHandle | undefined) ?? null,
    set: async (key, handle) => void (await run("readwrite", (s) => s.put(handle, key))),
    delete: async (key) => void (await run("readwrite", (s) => s.delete(key))),
  };
}

export interface PluginFolders {
  isSupported(): boolean;
  /** Ask the user for a folder and remember it under the binding id. Null if they cancel. */
  pick(bindingId: string): Promise<PluginFolderAccess | null>;
  /** The folder remembered under the binding id, once permission is granted; null otherwise. */
  open(bindingId: string): Promise<PluginFolderAccess | null>;
  forget(bindingId: string): Promise<void>;
}

/** Folder access scoped to one plugin. `picker` and `store` are injectable for tests. */
export function createPluginFolders(
  pluginId: string,
  picker: DirectoryPicker | undefined = (globalThis as { showDirectoryPicker?: DirectoryPicker })
    .showDirectoryPicker,
  store: FolderHandleStore = indexedDbStore(),
): PluginFolders {
  const key = (bindingId: string) => `${pluginId}:${bindingId}`;
  return {
    isSupported: () => typeof picker === "function",
    async pick(bindingId) {
      if (!picker) return null;
      let handle: FileSystemDirectoryHandle;
      try {
        handle = await picker({ mode: "readwrite" });
      } catch {
        return null; // the user cancelled the picker
      }
      await store.set(key(bindingId), handle);
      return access(handle);
    },
    async open(bindingId) {
      const handle = (await store.get(key(bindingId))) as PermissionedHandle | null;
      if (!handle || !(await hasPermission(handle))) return null;
      return access(handle);
    },
    async forget(bindingId) {
      await store.delete(key(bindingId));
    },
  };
}
