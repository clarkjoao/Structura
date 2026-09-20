/**
 * An in-memory stand-in for the File System Access API.
 *
 * jsdom has no real one, and the adapter's whole job is directories, handles
 * and writables — so the fake has to be faithful about those, not about the
 * bytes. Deliberately has no `FileSystemFileHandle.move`, which forces the
 * adapter down its copy+delete fallback in tests.
 */
type MemoryFile = { kind: "file"; content: string; lastModified: number };
type MemoryDir = { kind: "dir"; entries: Map<string, MemoryNode> };
type MemoryNode = MemoryFile | MemoryDir;

class FakeWritable {
  private chunks: string[] = [];
  constructor(private readonly onClose: (text: string) => void) {}
  async write(data: string | BufferSource): Promise<void> {
    this.chunks.push(typeof data === "string" ? data : new TextDecoder().decode(data));
  }
  async close(): Promise<void> {
    this.onClose(this.chunks.join(""));
  }
}

export function createMemoryFs() {
  const root: MemoryDir = { kind: "dir", entries: new Map() };

  function getNode(segments: string[]): MemoryNode | undefined {
    let current: MemoryNode = root;
    for (const segment of segments) {
      if (current.kind !== "dir") return undefined;
      const next = current.entries.get(segment);
      if (!next) return undefined;
      current = next;
    }
    return current;
  }

  function makeFileHandle(parent: MemoryDir, name: string): FileSystemFileHandle {
    const ensureFile = (): MemoryFile => {
      const existing = parent.entries.get(name);
      if (existing?.kind === "file") return existing;
      const created: MemoryFile = { kind: "file", content: "", lastModified: Date.now() };
      parent.entries.set(name, created);
      return created;
    };

    return {
      kind: "file",
      name,
      getFile: async () => {
        const file = ensureFile();
        return {
          text: async () => file.content,
          lastModified: file.lastModified,
        } as File;
      },
      createWritable: async () =>
        new FakeWritable((text) => {
          parent.entries.set(name, {
            kind: "file",
            content: text,
            lastModified: Date.now(),
          });
        }) as unknown as FileSystemWritableFileStream,
      // No move() — forces the copy+delete fallback so tests cover that path.
    } as FileSystemFileHandle;
  }

  function makeDirHandle(dir: MemoryDir, dirName: string): FileSystemDirectoryHandle {
    const handle = {
      kind: "directory",
      name: dirName,
      queryPermission: async () => "granted" as const,
      requestPermission: async () => "granted" as const,
      getDirectoryHandle: async (name: string, opts?: { create?: boolean }) => {
        let child = dir.entries.get(name);
        if (!child && opts?.create) {
          child = { kind: "dir", entries: new Map() };
          dir.entries.set(name, child);
        }
        if (!child || child.kind !== "dir") {
          throw new Error(`Directory not found: ${name}`);
        }
        return makeDirHandle(child, name);
      },
      getFileHandle: async (name: string, opts?: { create?: boolean }) => {
        let child = dir.entries.get(name);
        if (!child && opts?.create) {
          child = { kind: "file", content: "", lastModified: Date.now() };
          dir.entries.set(name, child);
        }
        if (!child || child.kind !== "file") {
          throw new Error(`File not found: ${name}`);
        }
        return makeFileHandle(dir, name);
      },
      removeEntry: async (name: string) => {
        if (!dir.entries.delete(name)) {
          const err = new Error(`NotFoundError: ${name}`);
          err.name = "NotFoundError";
          throw err;
        }
      },
      entries: async function* () {
        for (const [name, node] of dir.entries) {
          if (node.kind === "file") {
            yield [name, makeFileHandle(dir, name)] as const;
          } else {
            yield [name, makeDirHandle(node, name)] as const;
          }
        }
      },
    };
    return handle as unknown as FileSystemDirectoryHandle;
  }

  return {
    rootHandle: makeDirHandle(root, "workspace"),
    hasFile: (path: string) => getNode(path.split("/").filter(Boolean))?.kind === "file",
    readFile: (path: string) => {
      const node = getNode(path.split("/").filter(Boolean));
      return node?.kind === "file" ? node.content : null;
    },
    listNames: () => [...root.entries.keys()],
    seedTemp: (name: string, content: string, lastModified: number) => {
      root.entries.set(name, { kind: "file", content, lastModified });
    },
    /** Removes a file the way someone with a Finder window would. */
    removeAtRoot: (name: string) => root.entries.delete(name),
  };
}
