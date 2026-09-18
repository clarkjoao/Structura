import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { Diagram, Folder } from "@/features/diagram";
import { FileSystemAdapter } from "./FileSystemAdapter";
import {
  FOLDER_LAYOUT_VERSION,
  legacySlugify,
  planLegacyFolderMigration,
  repairFoldersFromDiagrams,
  resolveIdPathSegments,
  resolveLegacyPathSegments,
} from "./migrateLegacyFolderLayout";

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

  function ensureDir(segments: string[]): MemoryDir {
    let current = root;
    for (const segment of segments) {
      let child = current.entries.get(segment);
      if (!child || child.kind !== "dir") {
        child = { kind: "dir", entries: new Map() };
        current.entries.set(segment, child);
      }
      current = child;
    }
    return current;
  }

  function writeFile(segments: string[], name: string, content: string): void {
    const dir = ensureDir(segments);
    dir.entries.set(name, { kind: "file", content, lastModified: Date.now() });
  }

  function makeFileHandle(parent: MemoryDir, name: string): FileSystemFileHandle {
    return {
      kind: "file",
      name,
      getFile: async () => {
        const file = parent.entries.get(name);
        if (!file || file.kind !== "file") throw new Error(`missing ${name}`);
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
    } as FileSystemFileHandle;
  }

  function makeDirHandle(dir: MemoryDir, dirName: string): FileSystemDirectoryHandle {
    return {
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
        if (!child || child.kind !== "dir") throw new Error(`Directory not found: ${name}`);
        return makeDirHandle(child, name);
      },
      getFileHandle: async (name: string, opts?: { create?: boolean }) => {
        let child = dir.entries.get(name);
        if (!child && opts?.create) {
          child = { kind: "file", content: "", lastModified: Date.now() };
          dir.entries.set(name, child);
        }
        if (!child || child.kind !== "file") throw new Error(`File not found: ${name}`);
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
          if (node.kind === "file") yield [name, makeFileHandle(dir, name)] as const;
          else yield [name, makeDirHandle(node, name)] as const;
        }
      },
    } as unknown as FileSystemDirectoryHandle;
  }

  return {
    rootHandle: makeDirHandle(root, "workspace"),
    writeFile,
    hasFile: (path: string) => getNode(path.split("/").filter(Boolean))?.kind === "file",
    hasDir: (path: string) => getNode(path.split("/").filter(Boolean))?.kind === "dir",
  };
}

function minimalDiagram(id: string, overrides: Partial<Diagram> = {}): Diagram {
  return {
    id,
    name: `Diagram ${id}`,
    level: "context",
    createdAt: 1,
    updatedAt: 2,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

type AdapterInternals = { handle: FileSystemDirectoryHandle | null };

function attachHandle(adapter: FileSystemAdapter, handle: FileSystemDirectoryHandle): void {
  (adapter as unknown as AdapterInternals).handle = handle;
}

describe("legacySlugify / path helpers", () => {
  it("slugifies display names like the pre-ID layout", () => {
    expect(legacySlugify("Pix Ledger")).toBe("pix-ledger");
    expect(legacySlugify("Cobrança")).toBe("cobranca");
  });

  it("builds legacy paths with optional domain segment", () => {
    const folders: Record<string, Folder> = {
      "folder-abc123def45678": {
        id: "folder-abc123def45678",
        name: "Pix Ledger",
        parentId: null,
      },
    };
    const diagram = minimalDiagram("d1", {
      folderId: "folder-abc123def45678",
      domain: "Payments",
    });
    expect(resolveLegacyPathSegments(diagram, folders)).toEqual(["pix-ledger", "payments"]);
    expect(resolveIdPathSegments(diagram, folders)).toEqual(["folder-abc123def45678"]);
  });
});

describe("repairFoldersFromDiagrams", () => {
  it("creates stubs for missing folderIds using path segment names", () => {
    const diagrams = {
      d1: minimalDiagram("d1", { folderId: "folder-deadbeefdeadbe" }),
    };
    const { folders, repaired } = repairFoldersFromDiagrams({}, diagrams, {
      d1: ["pixledger"],
    });
    expect(repaired).toBe(1);
    expect(folders["folder-deadbeefdeadbe"]?.name).toBe("pixledger");
  });
});

describe("planLegacyFolderMigration", () => {
  it("plans a move from slug path to id path", () => {
    const folderId = "folder-abc123def45678";
    const folders: Record<string, Folder> = {
      [folderId]: { id: folderId, name: "Pix Ledger", parentId: null },
    };
    const diagrams = {
      d1: minimalDiagram("d1", { folderId }),
    };
    const plan = planLegacyFolderMigration(folders, diagrams, {
      d1: ["pix-ledger"],
    });
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0]?.toSegments).toEqual([folderId]);
    expect(plan.moves[0]?.fromSegments).toEqual(["pix-ledger"]);
  });
});

describe("FileSystemAdapter.migrateLegacyFolderLayout", () => {
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

  it("moves a diagram from slug path to folder-id path and removes the legacy file", async () => {
    const folderId = "folder-abc123def45678";
    const diagram = minimalDiagram("d1", { folderId, name: "Cob API" });
    const folders: Record<string, Folder> = {
      [folderId]: { id: folderId, name: "Pix Ledger", parentId: null },
    };

    fs.writeFile(["pix-ledger"], "d1.json", JSON.stringify(diagram));
    fs.writeFile(
      [],
      "structura-manifest.json",
      JSON.stringify({
        version: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        diagramIds: ["d1"],
        serviceCatalog: {},
        folders,
        activeDiagramId: "d1",
      }),
    );

    const result = await adapter.migrateLegacyFolderLayout(folders);
    expect(result.skipped).toBe(false);
    expect(result.filesMoved).toBe(1);
    expect(fs.hasFile(`${folderId}/d1.json`)).toBe(true);
    expect(fs.hasFile("pix-ledger/d1.json")).toBe(false);

    const manifest = await adapter.readManifest();
    expect(manifest?.folderLayoutVersion).toBe(FOLDER_LAYOUT_VERSION);
  });

  it("repairs empty folders map from diagram folderIds", async () => {
    const folderId = "folder-deadbeefdeadbe";
    const diagram = minimalDiagram("d2", { folderId });
    fs.writeFile(["old-team"], "d2.json", JSON.stringify(diagram));
    fs.writeFile(
      [],
      "structura-manifest.json",
      JSON.stringify({
        version: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        diagramIds: ["d2"],
        serviceCatalog: {},
        folders: {},
        activeDiagramId: "d2",
      }),
    );

    const result = await adapter.migrateLegacyFolderLayout({});
    expect(result.skipped).toBe(false);
    expect(result.foldersRepaired).toBe(1);
    expect(result.folders[folderId]?.name).toBe("old-team");
    expect(fs.hasFile(`${folderId}/d2.json`)).toBe(true);
  });

  it("is a no-op when folderLayoutVersion is already current", async () => {
    const folderId = "folder-abc123def45678";
    const diagram = minimalDiagram("d3", { folderId });
    const folders: Record<string, Folder> = {
      [folderId]: { id: folderId, name: "Pix Ledger", parentId: null },
    };
    // Still on legacy path — but version stamp says already migrated.
    fs.writeFile(["pix-ledger"], "d3.json", JSON.stringify(diagram));
    fs.writeFile(
      [],
      "structura-manifest.json",
      JSON.stringify({
        version: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        diagramIds: ["d3"],
        serviceCatalog: {},
        folders,
        activeDiagramId: "d3",
        folderLayoutVersion: FOLDER_LAYOUT_VERSION,
      }),
    );

    const result = await adapter.migrateLegacyFolderLayout(folders);
    expect(result.skipped).toBe(true);
    expect(result.filesMoved).toBe(0);
    expect(fs.hasFile("pix-ledger/d3.json")).toBe(true);
  });

  it("moves domain-segment legacy paths to id-only paths", async () => {
    const folderId = "folder-abc123def45678";
    const diagram = minimalDiagram("d4", { folderId, domain: "Billing" });
    const folders: Record<string, Folder> = {
      [folderId]: { id: folderId, name: "Finance", parentId: null },
    };

    fs.writeFile(["finance", "billing"], "d4.json", JSON.stringify(diagram));
    fs.writeFile(
      [],
      "structura-manifest.json",
      JSON.stringify({
        version: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        diagramIds: ["d4"],
        serviceCatalog: {},
        folders,
        activeDiagramId: "d4",
      }),
    );

    const result = await adapter.migrateLegacyFolderLayout(folders);
    expect(result.skipped).toBe(false);
    expect(result.filesMoved).toBe(1);
    expect(fs.hasFile(`${folderId}/d4.json`)).toBe(true);
    expect(fs.hasFile("finance/billing/d4.json")).toBe(false);
  });
});
