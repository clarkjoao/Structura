import { describe, expect, it } from "vitest";
import type { Diagram, Folder } from "@/features/diagram";
import { FileSystemAdapter } from "./FileSystemAdapter";
import { createMemoryFs } from "./__testing__/memoryFileSystem";

const SUFFIX = ".walkthrough.json";

type AdapterInternals = { handle: FileSystemDirectoryHandle | null };

function connect(): { adapter: FileSystemAdapter; fs: ReturnType<typeof createMemoryFs> } {
  const fs = createMemoryFs();
  const adapter = new FileSystemAdapter();
  (adapter as unknown as AdapterInternals).handle = fs.rootHandle;
  return { adapter, fs };
}

function folder(id: string, parentId: string | null = null): Folder {
  return { id, name: id, parentId, createdAt: 0, updatedAt: 0 } as Folder;
}

function diagram(id: string, folderId?: string): Diagram {
  return {
    id,
    name: id,
    level: "context",
    createdAt: 1,
    updatedAt: 2,
    folderId,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

describe("a sidecar lands beside the diagrams of its folder", () => {
  it("writes into the folder's own directory", async () => {
    const { adapter, fs } = connect();
    adapter.setFolders({ payments: folder("payments") });

    await adapter.writeDiagram(diagram("d-1", "payments"));
    const segments = adapter.resolveSegmentsForFolder("payments");
    await adapter.writeSidecar(segments, `wt_1${SUFFIX}`, { hello: "world" });

    expect(fs.hasFile("payments/d-1.json")).toBe(true);
    expect(fs.hasFile("payments/wt_1.walkthrough.json")).toBe(true);
  });

  it("writes at the root when the item belongs to no folder", async () => {
    const { adapter, fs } = connect();

    await adapter.writeSidecar(adapter.resolveSegmentsForFolder(null), `wt_1${SUFFIX}`, {});

    expect(fs.hasFile("wt_1.walkthrough.json")).toBe(true);
  });

  it("resolves the same nested path a diagram in that folder resolves", async () => {
    const { adapter, fs } = connect();
    adapter.setFolders({ parent: folder("parent"), child: folder("child", "parent") });

    await adapter.writeDiagram(diagram("d-1", "child"));
    await adapter.writeSidecar(adapter.resolveSegmentsForFolder("child"), `wt_1${SUFFIX}`, {});

    expect(fs.hasFile("parent/child/d-1.json")).toBe(true);
    expect(fs.hasFile("parent/child/wt_1.walkthrough.json")).toBe(true);
  });
});

describe("scanSidecars", () => {
  it("finds a sidecar with the segments it was found under", async () => {
    const { adapter } = connect();
    adapter.setFolders({ parent: folder("parent"), child: folder("child", "parent") });
    await adapter.writeSidecar(adapter.resolveSegmentsForFolder("child"), `wt_1${SUFFIX}`, {
      title: "Tour",
    });

    const found = await adapter.scanSidecars(SUFFIX);

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("wt_1");
    expect(found[0].segments).toEqual(["parent", "child"]);
    expect(found[0].raw).toEqual({ title: "Tour" });
  });

  it("does not return diagrams or the manifest", async () => {
    const { adapter } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    await adapter.writeSidecar([], `wt_1${SUFFIX}`, {});

    const found = await adapter.scanSidecars(SUFFIX);

    expect(found.map((f) => f.id)).toEqual(["wt_1"]);
  });

  it("reports an unreadable file rather than omitting it", async () => {
    const { adapter, fs } = connect();
    fs.seedTemp(`wt_bad${SUFFIX}`, "{ not json", Date.now());

    const found = await adapter.scanSidecars(SUFFIX);

    // Absence means "deleted" to the reconciliation, so a file that is there
    // but unreadable must never be reported as absent.
    expect(found).toHaveLength(1);
    expect(found[0].unreadable).toBe(true);
  });

  it("finds nothing once the file is deleted", async () => {
    const { adapter } = connect();
    await adapter.writeSidecar([], `wt_1${SUFFIX}`, {});

    await adapter.deleteSidecarAtSegments([], `wt_1${SUFFIX}`);

    expect(await adapter.scanSidecars(SUFFIX)).toHaveLength(0);
  });
});

describe("deleteSidecarAtSegments", () => {
  it("removes the file", async () => {
    const { adapter, fs } = connect();
    await adapter.writeSidecar([], `wt_1${SUFFIX}`, {});

    await adapter.deleteSidecarAtSegments([], `wt_1${SUFFIX}`);

    expect(fs.hasFile("wt_1.walkthrough.json")).toBe(false);
  });

  it("succeeds when the file was already gone", async () => {
    const { adapter } = connect();

    expect(await adapter.deleteSidecarAtSegments([], `wt_missing${SUFFIX}`)).toBe(true);
  });

  it("leaves a deletion marker when removal fails", async () => {
    const { adapter, fs } = connect();
    await adapter.writeSidecar([], `wt_1${SUFFIX}`, { title: "Tour" });

    // A folder handle whose removeEntry refuses, as a read-only mount would.
    const real = fs.rootHandle;
    const refusing = {
      ...real,
      kind: "directory",
      getDirectoryHandle: real.getDirectoryHandle.bind(real),
      getFileHandle: real.getFileHandle.bind(real),
      entries: (real as unknown as { entries: () => unknown }).entries.bind(real),
      removeEntry: async () => {
        throw new Error("read-only");
      },
    } as unknown as FileSystemDirectoryHandle;
    (adapter as unknown as AdapterInternals).handle = refusing;

    await adapter.deleteSidecarAtSegments([], `wt_1${SUFFIX}`);

    // Without the marker, the next read would see a readable file and write the
    // walkthrough straight back.
    expect(JSON.parse(fs.readFile("wt_1.walkthrough.json") ?? "{}")).toEqual({ deleted: true });
  });
});

describe("the workspace scan and sidecars", () => {
  it("finds the diagram and reports no invalid file", async () => {
    const { adapter } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    await adapter.writeSidecar([], `wt_1${SUFFIX}`, { kind: "structura-walkthrough" });

    const scan = await adapter.scanWorkspace();

    expect(scan.valid.map((d) => d.id)).toEqual(["d-1"]);
    // Before the skip, the walkthrough file reached validateDiagramFile, failed,
    // and surfaced to the user as a corrupt diagram in the merge dialog.
    expect(scan.invalid).toEqual([]);
  });

  it("does not even open a sidecar while scanning", async () => {
    const { adapter } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    await adapter.writeSidecar([], `wt_1${SUFFIX}`, {});

    const scan = await adapter.scanWorkspace();

    // Skipping by name, before the read, is what keeps boot cheap and what lets
    // a workspace scan cleanly with the feature switched off entirely.
    expect(scan.totalFilesScanned).toBe(1);
  });

  it("keeps a sidecar out of the diagrams a reconnect loads", async () => {
    const { adapter } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    await adapter.writeSidecar([], `wt_1${SUFFIX}`, {});
    await adapter.writeManifest({
      version: 1,
      updatedAt: new Date().toISOString(),
      activeDiagramId: "d-1",
      folders: {},
    } as never);

    const workspace = await adapter.loadWorkspace();

    expect(Object.keys(workspace?.diagrams ?? {})).toEqual(["d-1"]);
  });
});
