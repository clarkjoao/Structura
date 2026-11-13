import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiagramStore } from "@/features/diagram/store/diagram.store";
import { buildPersistStoragePayload, PERSIST_KEY } from "@/features/diagram/store/persist.config";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { bootWorkspaceStorage, type WorkspaceBootResult } from "./bootWorkspaceStorage";
import { IndexedDbAdapter } from "./IndexedDbAdapter";
import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { readRescue } from "./workspaceRescue";
import { WorkspaceStorage } from "./workspaceStorage";

const KEY = "diagram-store";

function idbWorkspace(factory: IDBFactory, now?: () => number) {
  const local = new LocalStorageAdapter();
  return new WorkspaceStorage(
    local,
    () => bootWorkspaceStorage({ factory, local, key: KEY, now }),
    now,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("WorkspaceStorage", () => {
  it("uses the same key as the diagram store's persist", () => {
    expect(PERSIST_KEY).toBe(KEY);
  });

  it("holds every call until the boot has chosen an adapter", async () => {
    let finish: (result: WorkspaceBootResult) => void = () => {};
    const local = new LocalStorageAdapter();
    const storage = new WorkspaceStorage(
      local,
      () => new Promise<WorkspaceBootResult>((resolve) => (finish = resolve)),
    );
    localStorage.setItem(`structura_${KEY}`, "stored");
    let read: string | null | undefined;
    void storage.getItem(KEY).then((value) => (read = value));
    await Promise.resolve();
    expect(read).toBeUndefined();
    expect(storage.current).toBeNull();
    finish({ storage: local, outcome: "localstorage-no-indexeddb" });
    await vi.waitFor(() => expect(read).toBe("stored"));
    expect(storage.current).toBe(local);
  });

  it("applies a pause set before the boot to the chosen adapter", async () => {
    const storage = idbWorkspace(new IDBFactory());
    storage.paused = true;
    await storage.setItem(KEY, "ignored");
    expect(await storage.getItem(KEY)).toBeNull();
    expect(storage.current?.paused).toBe(true);
    expect(await storage.forceSave(KEY, "forced")).toBe(true);
    expect(await storage.getItem(KEY)).toBe("forced");
  });

  describe("writeOnLeave", () => {
    it("writes nothing before the boot has finished", () => {
      const storage = idbWorkspace(new IDBFactory());
      expect(storage.writeOnLeave(KEY, "v")).toBe(false);
      expect(readRescue(KEY)).toBeNull();
    });

    it("with IndexedDB, writes the synchronous rescue and the record", async () => {
      const factory = new IDBFactory();
      const storage = idbWorkspace(factory, () => 500);
      await storage.ready();
      expect(storage.writeOnLeave(KEY, "last edit")).toBe(true);
      expect(readRescue(KEY)).toEqual({ value: "last edit", savedAt: 500 });
      const current = storage.current;
      if (!(current instanceof IndexedDbAdapter)) throw new Error("expected IndexedDB");
      await vi.waitFor(async () =>
        expect(await current.getRecord(KEY)).toEqual({ value: "last edit", savedAt: 500 }),
      );
    });

    it("skips while paused unless forced", async () => {
      const storage = idbWorkspace(new IDBFactory());
      await storage.ready();
      storage.paused = true;
      expect(storage.writeOnLeave(KEY, "v")).toBe(false);
      expect(readRescue(KEY)).toBeNull();
      expect(storage.writeOnLeave(KEY, "v", { force: true })).toBe(true);
      expect(readRescue(KEY)?.value).toBe("v");
    });

    it("with localStorage, writes the workspace key synchronously and no rescue", async () => {
      const local = new LocalStorageAdapter();
      const storage = new WorkspaceStorage(local, async () => ({
        storage: local,
        outcome: "localstorage-no-indexeddb",
      }));
      await storage.ready();
      expect(storage.writeOnLeave(KEY, "v")).toBe(true);
      expect(localStorage.getItem(`structura_${KEY}`)).toBe("v");
      expect(readRescue(KEY)).toBeNull();
    });
  });
});

describe("diagram store on an IndexedDB workspace", () => {
  it("hydrates the workspace migrated from localStorage", async () => {
    const source = createTestDiagramStore();
    const diagram = source.getState().addDiagram("Migrated", "context");
    const payload = buildPersistStoragePayload(source.getState());
    localStorage.setItem(`structura_${KEY}`, JSON.stringify(payload));
    const storage = idbWorkspace(new IDBFactory());
    const hydrated = new Promise<unknown>((resolve) => {
      createDiagramStoreForTest(storage, resolve);
    });
    expect(await hydrated).toBeUndefined();
    expect(await storage.outcome).toBe("indexeddb-migrated");
    expect(localStorage.getItem(`structura_${KEY}`)).toBeNull();
    expect(store?.getState().diagrams[diagram.id]?.name).toBe("Migrated");
  });

  it("reports a failed read instead of hydrating an empty workspace", async () => {
    const storage = idbWorkspace(new IDBFactory());
    await storage.ready();
    vi.spyOn(IndexedDbAdapter.prototype, "getRecord").mockRejectedValue(new Error("read failed"));
    const error = await new Promise<unknown>((resolve) => {
      createDiagramStoreForTest(storage, resolve);
    });
    expect(error).toBeInstanceOf(Error);
  });
});

let store: ReturnType<typeof createDiagramStore> | null = null;

function createDiagramStoreForTest(storage: WorkspaceStorage, onRehydrated: (e?: unknown) => void) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  store = createDiagramStore(storage, undefined, onRehydrated);
}
