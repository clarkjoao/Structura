import { StrictMode, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  isConnected: false,
  needsPermission: false,
  hasPermissionError: false,
  folderName: "ws" as string | null,
  pendingFolderName: null as string | null,
  missingFolderName: null as string | null,
  tryReconnect: vi.fn(async () => false),
  connect: vi.fn(async () => true),
  loadWorkspace: vi.fn(async () => null),
  scanWorkspace: vi.fn(async () => ({ valid: [], totalFilesScanned: 3, manifest: null })),
  setPermissionErrorCallback: vi.fn(),
  setFolderMissingCallback: vi.fn(),
  setFolders: vi.fn(),
  computePathSegments: vi.fn(() => [] as string[]),
  checkPermission: vi.fn(async () => true),
  ensureFolderExists: vi.fn(async () => true),
}));

vi.hoisted(() => {
  Object.defineProperty(globalThis, "showDirectoryPicker", { value: () => {}, configurable: true });
});

vi.mock("./FileSystemAdapter", () => ({ fileSystemAdapter: adapter }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import "@/features/elements/bootstrap";
import { stopFileSystemSync, resetBootState } from "./fileSystemBoot";
import { useFolderSyncStatusStore } from "./folderSyncStatus.store";
import { useFileSystemStorage } from "./useFileSystemStorage";

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

beforeEach(() => {
  vi.clearAllMocks();
  adapter.isConnected = false;
  adapter.needsPermission = false;
  adapter.folderName = "ws";
  adapter.tryReconnect.mockResolvedValue(false);
  resetBootState();
  useFolderSyncStatusStore.setState({ status: "disconnected", folderName: null });
});

afterEach(() => {
  stopFileSystemSync();
  resetBootState();
});

describe("useFileSystemStorage boot", () => {
  // 38ed79ea: StrictMode runs the mount effect twice; the boot must run once.
  it("boots once under StrictMode's double effect", async () => {
    renderHook(() => useFileSystemStorage(), { wrapper: strict });
    await act(async () => {
      await Promise.resolve();
    });
    expect(adapter.setPermissionErrorCallback).toHaveBeenCalledTimes(1);
    expect(adapter.setFolderMissingCallback).toHaveBeenCalledTimes(1);
    expect(adapter.tryReconnect).toHaveBeenCalledTimes(1);
  });

  // b3595158: an already connected folder is not asked to connect or reconnect again.
  it("shows a folder the adapter already holds as connected without reconnecting", () => {
    adapter.isConnected = true;
    renderHook(() => useFileSystemStorage(), { wrapper: strict });
    expect(adapter.tryReconnect).not.toHaveBeenCalled();
    expect(useFolderSyncStatusStore.getState().status).toBe("connected");
    expect(useFolderSyncStatusStore.getState().folderName).toBe("ws");
  });

  it("waits for a user gesture when the stored handle needs permission", async () => {
    adapter.needsPermission = true;
    adapter.pendingFolderName = "held";
    renderHook(() => useFileSystemStorage());
    await act(async () => {
      await Promise.resolve();
    });
    expect(useFolderSyncStatusStore.getState().status).toBe("needs_permission");
    expect(useFolderSyncStatusStore.getState().folderName).toBe("held");
  });

  // b3595158: the connection state is shared, so a caller that did not connect still learns of it.
  it("lets every caller of the hook see a connection made by one of them", async () => {
    const connector = renderHook(() => useFileSystemStorage());
    const banner = renderHook(() => useFileSystemStorage());
    await act(async () => {
      await Promise.resolve();
    });
    expect(banner.result.current.status).toBe("disconnected");

    await act(async () => {
      await connector.result.current.connect();
    });

    expect(banner.result.current.status).toBe("connected");
    expect(banner.result.current.folderName).toBe("ws");
  });
});
