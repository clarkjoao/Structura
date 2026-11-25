import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  isConnected: true,
  folderName: "",
  checkPermission: vi.fn(async () => true),
  ensureFolderExists: vi.fn(async () => true),
  setFolders: vi.fn(),
  computePathSegments: vi.fn(() => [] as string[]),
  deleteAtSegments: vi.fn(async () => undefined),
  writeDiagramStaged: vi.fn(async (diagram: { id: string }) => ({ id: diagram.id })),
  rollbackStagedDiagrams: vi.fn(async () => undefined),
  writeManifestWithRetry: vi.fn(async () => true),
  commitStagedDiagrams: vi.fn(async () => true),
}));

vi.mock("./FileSystemAdapter", () => ({ fileSystemAdapter: adapter }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import "@/features/elements/bootstrap";
import { useDiagramStore, VIEWPORT_DEBOUNCE_MS } from "@/features/diagram";
import { startFileSystemSync, stopFileSystemSync } from "./fileSystemBoot";
import { useFolderSyncStatusStore } from "./folderSyncStatus.store";

/** Lets the debounce fire and the flush chain's awaits run. */
async function settle(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

describe("folder sync writes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useFolderSyncStatusStore.setState({ status: "connected", lastWrite: "unknown" });
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram(`Folder ${Math.random()}`, "context");
    store.openDiagram(diagram.id);
    startFileSystemSync();
  });

  afterEach(() => {
    stopFileSystemSync();
    vi.useRealTimers();
  });

  it("reports a failed manifest write and writes the same change again on the retry", async () => {
    adapter.writeManifestWithRetry.mockResolvedValueOnce(false);
    useDiagramStore.getState().addComponent("container", "Api", null, { x: 0, y: 0 });
    await settle(VIEWPORT_DEBOUNCE_MS + 10);

    expect(useFolderSyncStatusStore.getState().lastWrite).toBe("failed");
    expect(adapter.rollbackStagedDiagrams).toHaveBeenCalled();
    const writesBefore = adapter.writeDiagramStaged.mock.calls.length;

    // No further edit: the retry alone writes the rolled-back change.
    await settle(15_000 + VIEWPORT_DEBOUNCE_MS + 10);
    expect(adapter.writeDiagramStaged.mock.calls.length).toBeGreaterThan(writesBefore);
    expect(useFolderSyncStatusStore.getState().lastWrite).toBe("ok");
  });

  it("reports a write that went through", async () => {
    useDiagramStore.getState().addComponent("container", "Web", null, { x: 0, y: 0 });
    await settle(VIEWPORT_DEBOUNCE_MS + 10);
    expect(useFolderSyncStatusStore.getState().lastWrite).toBe("ok");
  });

  it("forgets the result when the folder is no longer connected", () => {
    useFolderSyncStatusStore.setState({ lastWrite: "failed" });
    useFolderSyncStatusStore.getState().setStatus("disconnected");
    expect(useFolderSyncStatusStore.getState().lastWrite).toBe("unknown");
  });
});
