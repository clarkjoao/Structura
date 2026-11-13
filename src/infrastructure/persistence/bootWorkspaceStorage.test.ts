import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootWorkspaceStorage,
  WORKSPACE_MIGRATED_MARKER_KEY,
  type BootWorkspaceOptions,
} from "./bootWorkspaceStorage";
import { IndexedDbAdapter } from "./IndexedDbAdapter";
import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { readRescue, writeRescue } from "./workspaceRescue";

const KEY = "diagram-store";
const LOCAL_KEY = `structura_${KEY}`;

let factory: IDBFactory;
let local: LocalStorageAdapter;

function boot(overrides: Partial<BootWorkspaceOptions> = {}) {
  return bootWorkspaceStorage({ factory, local, key: KEY, ...overrides });
}

async function seedIdb(value: string, savedAt: number): Promise<void> {
  const idb = await IndexedDbAdapter.open(factory);
  await idb.putRecord(KEY, value, savedAt);
  idb.close();
}

beforeEach(() => {
  localStorage.clear();
  factory = new IDBFactory();
  local = new LocalStorageAdapter();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bootWorkspaceStorage", () => {
  it("stays on localStorage when the browser has no IndexedDB", async () => {
    localStorage.setItem(LOCAL_KEY, "ws");
    const result = await boot({ factory: undefined });
    expect(result.outcome).toBe("localstorage-no-indexeddb");
    expect(result.storage).toBe(local);
    expect(localStorage.getItem(LOCAL_KEY)).toBe("ws");
  });

  it("stays on localStorage when IndexedDB fails to open", async () => {
    localStorage.setItem(LOCAL_KEY, "ws");
    vi.spyOn(factory, "open").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const result = await boot();
    expect(result.outcome).toBe("localstorage-open-failed");
    expect(result.storage).toBe(local);
    expect(localStorage.getItem(LOCAL_KEY)).toBe("ws");
  });

  it("stays on localStorage when IndexedDB does not open in time", async () => {
    vi.useFakeTimers();
    try {
      const neverSettles: Partial<IDBOpenDBRequest> = {};
      vi.spyOn(factory, "open").mockReturnValue(neverSettles as IDBOpenDBRequest);
      const pending = boot({ timeoutMs: 50 });
      await vi.advanceTimersByTimeAsync(60);
      const result = await pending;
      expect(result.outcome).toBe("localstorage-open-failed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves the localStorage workspace into IndexedDB and removes it only after it reads back", async () => {
    localStorage.setItem(LOCAL_KEY, '{"state":{"diagrams":{}},"version":16}');
    const result = await boot();
    expect(result.outcome).toBe("indexeddb-migrated");
    expect(result.storage).toBeInstanceOf(IndexedDbAdapter);
    expect(await result.storage.getItem(KEY)).toBe('{"state":{"diagrams":{}},"version":16}');
    expect(localStorage.getItem(LOCAL_KEY)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_MIGRATED_MARKER_KEY)).toBe("1");
  });

  it("keeps the localStorage workspace and uses it when the copy reads back different", async () => {
    localStorage.setItem(LOCAL_KEY, "original");
    vi.spyOn(IndexedDbAdapter.prototype, "getRecord")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ value: "corrupted", savedAt: 1 });
    const result = await boot();
    expect(result.outcome).toBe("localstorage-migration-failed");
    expect(result.storage).toBe(local);
    expect(localStorage.getItem(LOCAL_KEY)).toBe("original");
    expect(localStorage.getItem(WORKSPACE_MIGRATED_MARKER_KEY)).toBeNull();
  });

  it("keeps the localStorage workspace when the copy fails to write", async () => {
    localStorage.setItem(LOCAL_KEY, "original");
    vi.spyOn(IndexedDbAdapter.prototype, "putRecord").mockRejectedValue(
      new DOMException("full", "QuotaExceededError"),
    );
    const result = await boot();
    expect(result.outcome).toBe("localstorage-migration-failed");
    expect(localStorage.getItem(LOCAL_KEY)).toBe("original");
  });

  it("uses IndexedDB and deletes neither copy when both exist after a completed migration", async () => {
    await seedIdb("idb", 100);
    localStorage.setItem(LOCAL_KEY, "saved later by an old-build tab");
    localStorage.setItem(WORKSPACE_MIGRATED_MARKER_KEY, "1");
    const result = await boot();
    expect(result.outcome).toBe("indexeddb");
    expect(await result.storage.getItem(KEY)).toBe("idb");
    expect(localStorage.getItem(LOCAL_KEY)).toBe("saved later by an old-build tab");
  });

  it("redoes a migration that was cut short (both copies, no marker)", async () => {
    await seedIdb("partial", 100);
    localStorage.setItem(LOCAL_KEY, "source");
    const result = await boot();
    expect(result.outcome).toBe("indexeddb-migrated");
    expect(await result.storage.getItem(KEY)).toBe("source");
    expect(localStorage.getItem(LOCAL_KEY)).toBeNull();
  });

  it("opens an existing IndexedDB workspace without touching localStorage", async () => {
    await seedIdb("idb", 100);
    const result = await boot();
    expect(result.outcome).toBe("indexeddb");
    expect(await result.storage.getItem(KEY)).toBe("idb");
  });

  it("adopts a rescue newer than the IndexedDB record, then removes it", async () => {
    await seedIdb("before the last edit", 100);
    writeRescue(KEY, "with the last edit", 200);
    const result = await boot();
    expect(await result.storage.getItem(KEY)).toBe("with the last edit");
    expect(readRescue(KEY)).toBeNull();
  });

  it("drops a rescue older than the IndexedDB record", async () => {
    await seedIdb("newer", 300);
    writeRescue(KEY, "stale", 200);
    const result = await boot();
    expect(await result.storage.getItem(KEY)).toBe("newer");
    expect(readRescue(KEY)).toBeNull();
  });

  it("adopts a rescue when IndexedDB holds nothing", async () => {
    writeRescue(KEY, "only copy", 200);
    const result = await boot();
    expect(await result.storage.getItem(KEY)).toBe("only copy");
    expect(readRescue(KEY)).toBeNull();
  });
});
