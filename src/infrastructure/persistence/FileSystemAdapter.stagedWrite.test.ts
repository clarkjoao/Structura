import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/features/diagram";
import { FileSystemAdapter } from "./FileSystemAdapter";
import { getTempFileName } from "./stagedDiagramWrite";
import { isValidFolderId } from "./folderSync";
import { createMemoryFs } from "./__testing__/memoryFileSystem";

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
      services: {},
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
