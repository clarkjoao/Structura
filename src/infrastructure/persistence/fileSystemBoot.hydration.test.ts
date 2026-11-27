import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  isConnected: false,
  folderName: "ws",
  tryReconnect: vi.fn(async () => true),
  loadWorkspace: vi.fn<() => Promise<unknown>>(async () => null),
  scanWorkspace: vi.fn(async () => ({ valid: [], totalFilesScanned: 0, manifest: null })),
  setFolders: vi.fn(),
  computePathSegments: vi.fn(() => [] as string[]),
}));

vi.mock("./FileSystemAdapter", () => ({ fileSystemAdapter: adapter }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import "@/features/elements/bootstrap";
import { useDiagramStore } from "@/features/diagram";
import type { Diagram } from "@/features/diagram";
import { awaitBootScan, bootFileSystem, resetBootState } from "./fileSystemBoot";
import { workspaceStorage } from "./workspaceStorage";

function diagram(id: string, extra: Partial<Diagram> = {}): Diagram {
  return {
    id,
    name: id,
    level: "context",
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...extra,
  } as Diagram;
}

function emptyStore(): void {
  useDiagramStore.setState({ diagrams: {}, folders: {}, services: {}, activeDiagramId: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "showDirectoryPicker", { value: vi.fn(), configurable: true });
  vi.spyOn(workspaceStorage, "delete").mockResolvedValue(undefined);
  resetBootState();
  emptyStore();
});

afterEach(() => {
  resetBootState();
  Reflect.deleteProperty(globalThis, "showDirectoryPicker");
  vi.restoreAllMocks();
});

describe("bootFileSystem hydration", () => {
  // 8cdf408d: manifest.folders is not validated, so it can be absent; reading it threw,
  // the silent catch swallowed it and the folder-backed workspace never loaded.
  it("hydrates a workspace whose manifest has no folder map and leaves folderId alone", async () => {
    adapter.loadWorkspace.mockResolvedValue({
      diagrams: { d1: diagram("d1", { folderId: "f-unknown", updatedAt: 5 }) },
      services: {},
      folders: undefined,
      activeDiagramId: "d1",
    });

    await expect(bootFileSystem()).resolves.toBe(true);

    const loaded = useDiagramStore.getState().diagrams["d1"];
    expect(loaded?.name).toBe("d1");
    expect(loaded?.folderId).toBe("f-unknown");
    expect(useDiagramStore.getState().activeDiagramId).toBe("d1");
  });

  // 5cd0df8e: files saved without timestamps must hydrate, not throw or read as "newer".
  it("hydrates diagrams without timestamps and a manifest without updatedAt", async () => {
    adapter.loadWorkspace.mockResolvedValue({
      diagrams: {
        a: diagram("a"),
        b: diagram("b", { updatedAt: Number.NaN }),
      },
      services: {},
      folders: {},
      activeDiagramId: "a",
    });

    await expect(bootFileSystem()).resolves.toBe(true);

    expect(Object.keys(useDiagramStore.getState().diagrams).sort()).toEqual(["a", "b"]);
  });

  it("hands a newer in-memory workspace to the merge dialog instead of overwriting it", async () => {
    useDiagramStore.setState({ diagrams: { mem: diagram("mem", { updatedAt: 9_000 }) } });
    const scan = { valid: [], totalFilesScanned: 1, manifest: null };
    adapter.scanWorkspace.mockResolvedValue(scan);
    adapter.loadWorkspace.mockResolvedValue({
      diagrams: { disk: diagram("disk", { updatedAt: 1 }) },
      services: {},
      folders: {},
      activeDiagramId: "disk",
    });
    const conflict = awaitBootScan();

    await expect(bootFileSystem()).resolves.toBe(true);

    await expect(conflict).resolves.toBe(scan);
    expect(Object.keys(useDiagramStore.getState().diagrams)).toEqual(["mem"]);
  });

  it("reports a failed reconnect without loading anything", async () => {
    adapter.tryReconnect.mockResolvedValue(false);
    await expect(bootFileSystem()).resolves.toBe(false);
    expect(adapter.loadWorkspace).not.toHaveBeenCalled();
  });

  // 38ed79ea: booting twice (StrictMode, two callers) must perform one boot.
  it("booting twice performs one reconnect and shares the result", async () => {
    adapter.loadWorkspace.mockResolvedValue(null);
    const first = bootFileSystem();
    const second = bootFileSystem();
    expect(second).toBe(first);
    await first;
    await bootFileSystem();
    expect(adapter.tryReconnect).toHaveBeenCalledTimes(1);
  });
});
