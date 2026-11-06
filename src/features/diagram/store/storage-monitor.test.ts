import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceStorage } from "@/infrastructure/persistence/workspaceStorage";
import { useSaveStatusStore } from "./saveStatus.store";
import { checkStorageHealth } from "./storage-monitor";

const MB = 1024 * 1024;
const GB = 1024 * MB;

function resetHealth(): void {
  useSaveStatusStore.setState({
    storageHealthLevel: "ok",
    storageUsedBytes: 0,
    storageQuotaBytes: null,
  });
}

describe("storage health thresholds", () => {
  beforeEach(resetHealth);

  it("localStorage: warns at 3 MB and 4 MB", () => {
    const { _setStorageUsage } = useSaveStatusStore.getState();
    _setStorageUsage(2.9 * MB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("ok");
    _setStorageUsage(3 * MB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("warning");
    _setStorageUsage(4 * MB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("danger");
  });

  it("IndexedDB: a 6 MB workspace is fine under a multi-GB quota; warns at 80 % and 95 %", () => {
    const { _setStorageUsage } = useSaveStatusStore.getState();
    _setStorageUsage(6 * MB, 10 * GB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("ok");
    _setStorageUsage(8 * GB, 10 * GB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("warning");
    _setStorageUsage(9.5 * GB, 10 * GB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("danger");
    expect(useSaveStatusStore.getState().storageQuotaBytes).toBe(10 * GB);
  });

  it("a failed save stays critical until usage drops below the warning line", () => {
    const state = useSaveStatusStore.getState();
    state._setStorageCritical();
    state._setStorageUsage(9 * GB, 10 * GB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("critical");
    state._setStorageUsage(1 * GB, 10 * GB);
    expect(useSaveStatusStore.getState().storageHealthLevel).toBe("ok");
  });
});

describe("checkStorageHealth", () => {
  const estimate = vi.fn<() => Promise<StorageEstimate>>();

  beforeEach(() => {
    resetHealth();
    localStorage.clear();
    estimate.mockReset();
    estimate.mockResolvedValue({ usage: 6 * MB, quota: 10 * GB });
    Object.defineProperty(navigator, "storage", { value: { estimate }, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "storage");
  });

  it("uses the origin quota when the workspace is in IndexedDB", async () => {
    vi.spyOn(workspaceStorage, "location", "get").mockReturnValue("indexeddb");
    await checkStorageHealth();
    expect(estimate).toHaveBeenCalled();
    expect(useSaveStatusStore.getState()).toMatchObject({
      storageUsedBytes: 6 * MB,
      storageQuotaBytes: 10 * GB,
      storageHealthLevel: "ok",
    });
  });

  it("measures localStorage when the workspace is there", async () => {
    vi.spyOn(workspaceStorage, "location", "get").mockReturnValue("localstorage");
    localStorage.setItem("structura_diagram-store", "x".repeat(1000));
    await checkStorageHealth();
    expect(estimate).not.toHaveBeenCalled();
    expect(useSaveStatusStore.getState().storageQuotaBytes).toBeNull();
    expect(useSaveStatusStore.getState().storageUsedBytes).toBeGreaterThan(2000);
  });

  it("falls back to localStorage when the browser gives no estimate", async () => {
    vi.spyOn(workspaceStorage, "location", "get").mockReturnValue("indexeddb");
    estimate.mockRejectedValue(new Error("unsupported"));
    await checkStorageHealth();
    expect(useSaveStatusStore.getState().storageQuotaBytes).toBeNull();
  });
});
