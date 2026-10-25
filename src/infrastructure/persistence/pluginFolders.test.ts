import { describe, expect, it } from "vitest";
import { createPluginFolders, type FolderHandleStore } from "./pluginFolders";

/** A directory handle over a Map of file name → text. */
function fakeDirectory(
  name: string,
  files: Record<string, string>,
  permission: PermissionState = "granted",
) {
  const contents = new Map(Object.entries(files));
  const modified = new Map([...contents.keys()].map((file) => [file, 1]));
  const fileHandle = (file: string) => ({
    kind: "file" as const,
    name: file,
    getFile: async () => ({
      text: async () => contents.get(file) ?? "",
      lastModified: modified.get(file) ?? 0,
      size: (contents.get(file) ?? "").length,
    }),
    createWritable: async () => {
      let buffer = "";
      return {
        write: async (text: string) => void (buffer += text),
        close: async () => {
          contents.set(file, buffer);
          modified.set(file, (modified.get(file) ?? 0) + 1);
        },
      };
    },
  });
  const handle = {
    kind: "directory" as const,
    name,
    async getFileHandle(file: string, options?: { create?: boolean }) {
      if (!contents.has(file) && !options?.create)
        throw new DOMException("missing", "NotFoundError");
      return fileHandle(file);
    },
    async *entries() {
      for (const file of contents.keys()) yield [file, { kind: "file" }];
      yield ["sub", { kind: "directory" }];
    },
    queryPermission: async () => permission,
    requestPermission: async () => permission,
  };
  return { handle: handle as unknown as FileSystemDirectoryHandle, contents };
}

/** A directory tree over a Map of relative path → text; sub-folders exist while a path is under them. */
function fakeTree(name: string, initial: Record<string, string>) {
  const files = new Map(Object.entries(initial));
  const dir = (prefix: string, dirName: string): unknown => ({
    kind: "directory" as const,
    name: dirName,
    async getFileHandle(file: string, options?: { create?: boolean }) {
      const path = prefix + file;
      if (!files.has(path) && !options?.create) throw new DOMException("missing", "NotFoundError");
      return {
        kind: "file" as const,
        name: file,
        getFile: async () => ({
          text: async () => files.get(path) ?? "",
          lastModified: 1,
          size: (files.get(path) ?? "").length,
        }),
        createWritable: async () => {
          let buffer = "";
          return {
            write: async (text: string) => void (buffer += text),
            close: async () => void files.set(path, buffer),
          };
        },
      };
    },
    async getDirectoryHandle(sub: string, options?: { create?: boolean }) {
      const next = `${prefix}${sub}/`;
      if (!options?.create && ![...files.keys()].some((p) => p.startsWith(next))) {
        throw new DOMException("missing", "NotFoundError");
      }
      return dir(next, sub);
    },
    async *entries() {
      const seen = new Set<string>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const [head, ...rest] = path.slice(prefix.length).split("/");
        if (rest.length === 0) yield [head, { kind: "file" }];
        else if (!seen.has(head!)) {
          seen.add(head!);
          yield [head, dir(`${prefix}${head}/`, head!)];
        }
      }
    },
    queryPermission: async () => "granted" as PermissionState,
  });
  return { handle: dir("", name) as FileSystemDirectoryHandle, files };
}

function memoryStore(): FolderHandleStore {
  const map = new Map<string, FileSystemDirectoryHandle>();
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, handle) => void map.set(key, handle),
    delete: async (key) => void map.delete(key),
  };
}

describe("plugin folders", () => {
  it("reports each file's last-modified time and size, and sees writes", async () => {
    const { handle } = fakeDirectory("shop", { "b.yaml": "bb", "a.yaml": "a" });
    const folder = (await createPluginFolders("p", async () => handle, memoryStore()).pick("d1"))!;
    expect(await folder.stats()).toEqual([
      { name: "a.yaml", lastModified: 1, size: 1 },
      { name: "b.yaml", lastModified: 1, size: 2 },
    ]);
    await folder.write("a.yaml", "aaa");
    expect((await folder.stats())[0]).toEqual({ name: "a.yaml", lastModified: 2, size: 3 });
  });

  it("picks a folder, lists its files, reads and writes them", async () => {
    const { handle, contents } = fakeDirectory("shop", {
      "b.opscr.yaml": "b",
      "a.opscr.yaml": "a",
    });
    const folders = createPluginFolders("p", async () => handle, memoryStore());
    const folder = (await folders.pick("d1"))!;
    expect(folder.name).toBe("shop");
    expect(await folder.list()).toEqual(["a.opscr.yaml", "b.opscr.yaml"]);
    expect(await folder.read("a.opscr.yaml")).toBe("a");
    await folder.write("a.opscr.yaml", "edited");
    expect(contents.get("a.opscr.yaml")).toBe("edited");
  });

  it("reopens the folder remembered under a binding id, per plugin", async () => {
    const store = memoryStore();
    const { handle } = fakeDirectory("shop", { "a.opscr.yaml": "a" });
    await createPluginFolders("p", async () => handle, store).pick("d1");
    const later = createPluginFolders("p", undefined, store);
    expect((await later.open("d1"))?.name).toBe("shop");
    expect(await later.open("d2")).toBeNull();
    expect(await createPluginFolders("other", undefined, store).open("d1")).toBeNull();
    await later.forget("d1");
    expect(await later.open("d1")).toBeNull();
  });

  it("gives nothing back when permission is denied or the picker is cancelled", async () => {
    const store = memoryStore();
    const { handle } = fakeDirectory("shop", {}, "denied");
    await createPluginFolders("p", async () => handle, store).pick("d1");
    expect(await createPluginFolders("p", undefined, store).open("d1")).toBeNull();
    const cancelled = createPluginFolders(
      "p",
      async () => Promise.reject(new DOMException("x", "AbortError")),
      store,
    );
    expect(await cancelled.pick("d2")).toBeNull();
  });

  it("rejects names that would leave the folder", async () => {
    const { handle } = fakeDirectory("shop", {});
    const folder = (await createPluginFolders("p", async () => handle, memoryStore()).pick("d1"))!;
    for (const name of [
      "../secret.txt",
      "sub/../../x",
      "/etc/x",
      "a//b",
      "a/./b",
      "..",
      "",
      "a\\b",
    ]) {
      await expect(folder.read(name), name).rejects.toThrow(/not a (file name|path) inside/);
      await expect(folder.write(name, "x"), name).rejects.toThrow(/not a (file name|path) inside/);
    }
  });

  it("lists, reads and writes files in sub-folders by relative path", async () => {
    const root = fakeTree("shop", {
      "opscr.workspace.yaml": "product: shop",
      "initiatives/plan/initiative.opscr.yaml": "kind: Initiative",
    });
    const folder = (await createPluginFolders("p", async () => root.handle, memoryStore()).pick(
      "d1",
    ))!;
    expect(await folder.list()).toEqual(["opscr.workspace.yaml"]);
    expect(await folder.list({ recursive: true })).toEqual([
      "initiatives/plan/initiative.opscr.yaml",
      "opscr.workspace.yaml",
    ]);
    expect(await folder.read("initiatives/plan/initiative.opscr.yaml")).toBe("kind: Initiative");
    await folder.write("initiatives/next/initiative.opscr.yaml", "new");
    expect(root.files.get("initiatives/next/initiative.opscr.yaml")).toBe("new");
    expect((await folder.stats({ recursive: true })).map((s) => s.name)).toContain(
      "initiatives/next/initiative.opscr.yaml",
    );
  });

  it("is unsupported without a directory picker", () => {
    expect(createPluginFolders("p", undefined, memoryStore()).isSupported()).toBe(false);
  });
});
