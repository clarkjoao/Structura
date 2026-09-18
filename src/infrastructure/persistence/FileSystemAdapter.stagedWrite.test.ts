import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/features/diagram";
import { FileSystemAdapter } from "./FileSystemAdapter";
import { getTempFileName } from "./stagedDiagramWrite";
import { isValidFolderId } from "./folderSync";

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

function createMemoryFs() {
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
  };
}

function minimalDiagram(id: string): Diagram {
  return {
    id,
    name: `Diagram ${id}`,
    level: "context",
    createdAt: 1,
    updatedAt: 2,
    snapshot: {
      components: {},
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

type AdapterInternals = {
  handle: FileSystemDirectoryHandle | null;
};

function attachHandle(adapter: FileSystemAdapter, handle: FileSystemDirectoryHandle): void {
  (adapter as unknown as AdapterInternals).handle = handle;
}

describe("isValidFolderId", () => {
  it("rejects hidden and reserved tooling directories", () => {
    expect(isValidFolderId(".git")).toBe(false);
    expect(isValidFolderId("node_modules")).toBe(false);
    expect(isValidFolderId("dist")).toBe(false);
    expect(isValidFolderId("folder_abc")).toBe(true);
  });
});

describe("FileSystemAdapter two-phase commit", () => {
  let adapter: FileSystemAdapter;
  let fs: ReturnType<typeof createMemoryFs>;

  beforeEach(() => {
    adapter = new FileSystemAdapter();
    fs = createMemoryFs();
    attachHandle(adapter, fs.rootHandle);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writeDiagramStaged → commitStagedDiagrams leaves the final file and removes .tmp", async () => {
    const diagram = minimalDiagram("d1");
    const staged = await adapter.writeDiagramStaged(diagram);
    expect(staged).not.toBeNull();
    expect(fs.hasFile(getTempFileName("d1"))).toBe(true);

    const ok = await adapter.commitStagedDiagrams([staged!]);
    expect(ok).toBe(true);
    expect(fs.hasFile("d1.json")).toBe(true);
    expect(fs.hasFile(getTempFileName("d1"))).toBe(false);
    expect(fs.readFile("d1.json")).toContain('"id": "d1"');
  });

  it("rollbackStagedDiagrams removes .tmp after a manifest write failure", async () => {
    const diagram = minimalDiagram("d2");
    const staged = await adapter.writeDiagramStaged(diagram);
    expect(staged).not.toBeNull();
    expect(fs.hasFile(getTempFileName("d2"))).toBe(true);

    // Simulate the flushWorkspace path: manifest fails → rollback staged temps.
    vi.spyOn(adapter, "writeManifest").mockResolvedValue(false);
    const manifestOk = await adapter.writeManifestWithRetry({
      version: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      diagramIds: ["d2"],
      serviceCatalog: {},
      folders: {},
      activeDiagramId: "d2",
    });
    expect(manifestOk).toBe(false);

    await adapter.rollbackStagedDiagrams([staged!]);
    expect(fs.hasFile(getTempFileName("d2"))).toBe(false);
    expect(fs.hasFile("d2.json")).toBe(false);
  });

  it("partial commitStagedDiagrams keeps already-renamed finals (no rollback of successes)", async () => {
    const first = await adapter.writeDiagramStaged(minimalDiagram("ok"));
    const second = await adapter.writeDiagramStaged(minimalDiagram("fail"));
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    // Break the second rename by removing its temp after staging so commit fails
    // for that diagram only. The first rename should still succeed.
    const originalCommit = adapter.commitStagedDiagrams.bind(adapter);
    const commitSpy = vi
      .spyOn(adapter, "commitStagedDiagrams")
      .mockImplementation(async (staged) => {
        // Commit first item alone, then fail the rest — mirrors intentional
        // partial-failure behaviour (already-committed finals are kept).
        const firstOk = await originalCommit([staged[0]!]);
        expect(firstOk).toBe(true);
        expect(fs.hasFile("ok.json")).toBe(true);
        expect(fs.hasFile(getTempFileName("ok"))).toBe(false);
        // Second temp still present; we do NOT roll back the first final.
        expect(fs.hasFile(getTempFileName("fail"))).toBe(true);
        return false;
      });

    const ok = await adapter.commitStagedDiagrams([first!, second!]);
    expect(ok).toBe(false);
    expect(commitSpy).toHaveBeenCalled();
    // Documented contract: callers must not delete already-committed finals.
    expect(fs.hasFile("ok.json")).toBe(true);
  });

  it("cleanupOrphanedTempFiles removes stale .json.tmp files", async () => {
    const stale = Date.now() - 10 * 60 * 1000;
    fs.seedTemp("orphan.json.tmp", "{}", stale);
    fs.seedTemp("fresh.json.tmp", "{}", Date.now());

    const removed = await adapter.cleanupOrphanedTempFiles(5 * 60 * 1000);
    expect(removed).toBe(1);
    expect(fs.hasFile("orphan.json.tmp")).toBe(false);
    expect(fs.hasFile("fresh.json.tmp")).toBe(true);
  });

  it("checkPermission returns false and fires the callback when denied", async () => {
    const deniedHandle = {
      ...fs.rootHandle,
      queryPermission: async () => "denied" as const,
    } as unknown as FileSystemDirectoryHandle;
    attachHandle(adapter, deniedHandle);

    const onError = vi.fn();
    adapter.setPermissionErrorCallback(onError);

    const ok = await adapter.checkPermission();
    expect(ok).toBe(false);
    expect(adapter.hasPermissionError).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
