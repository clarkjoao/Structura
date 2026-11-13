import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootWorkspaceStorage } from "@/infrastructure/persistence/bootWorkspaceStorage";
import { InMemoryAdapter } from "@/infrastructure/persistence/InMemoryAdapter";
import { IndexedDbAdapter } from "@/infrastructure/persistence/IndexedDbAdapter";
import { LocalStorageAdapter } from "@/infrastructure/persistence/LocalStorageAdapter";
import { readRescue } from "@/infrastructure/persistence/workspaceRescue";
import { WorkspaceStorage } from "@/infrastructure/persistence/workspaceStorage";
import { PERSIST_DEBOUNCE_MS } from "@/lib/timing.constants";
import { createDiagramStore } from "./diagram.store";
import { buildPersistStoragePayload, PERSIST_KEY } from "./persist.config";
import { useSaveStatusStore } from "./saveStatus.store";
import { createTestDiagramStore } from "./test-utils";

/*
 * IndexedDB answers asynchronously and zustand's persist writes on every
 * `set()`, hydrated or not. A write in between would replace the stored
 * workspace with the empty one in memory (openspec indexeddb-workspace-storage,
 * "Nothing is written before the workspace is read").
 */

function storedWorkspace(name: string): { json: string; id: string } {
  const source = createTestDiagramStore();
  const diagram = source.getState().addDiagram(name, "context");
  return { json: JSON.stringify(buildPersistStoragePayload(source.getState())), id: diagram.id };
}

/** An adapter whose read of the workspace waits until `release` is called. */
class SlowReadAdapter extends InMemoryAdapter {
  private releaseRead: () => void = () => {};

  private readonly gate = new Promise<void>((resolve) => (this.releaseRead = resolve));

  failRead = false;

  release(): void {
    this.releaseRead();
  }

  /** The stored value, without waiting for the gate. */
  peek(key: string): Promise<string | null> {
    return super.getItem(key);
  }

  override async getItem(key: string): Promise<string | null> {
    if (key === PERSIST_KEY) {
      await this.gate;
      if (this.failRead) throw new Error("read failed");
    }
    return super.getItem(key);
  }
}

describe("read before write", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSaveStatusStore.setState({ status: "idle" });
  });
  afterEach(() => vi.useRealTimers());

  it("writes nothing while the read is pending, then loads the stored workspace unchanged", async () => {
    const adapter = new SlowReadAdapter();
    const stored = storedWorkspace("Stored");
    await adapter.setItem(PERSIST_KEY, stored.json);
    const setItem = vi.spyOn(adapter, "setItem");

    const store = createDiagramStore(adapter);
    store.getState().addDiagram("Created before the read", "context");
    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS * 2);
    expect(setItem).not.toHaveBeenCalled();
    expect(await adapter.peek(PERSIST_KEY)).toBe(stored.json);

    adapter.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().diagrams[stored.id]?.name).toBe("Stored");

    store.getState().addDiagram("After the read", "context");
    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
    const written = setItem.mock.calls.filter(([key]) => key === PERSIST_KEY).pop()?.[1];
    expect(written).toContain("Stored");
    expect(written).toContain("After the read");
  });

  it("refuses to write after a failed read and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = new SlowReadAdapter();
    const stored = storedWorkspace("Stored");
    await adapter.setItem(PERSIST_KEY, stored.json);
    adapter.failRead = true;
    const setItem = vi.spyOn(adapter, "setItem");

    const store = createDiagramStore(adapter);
    adapter.release();
    await vi.advanceTimersByTimeAsync(0);
    store.getState().addDiagram("Edit on an unread workspace", "context");
    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);

    expect(setItem).not.toHaveBeenCalled();
    expect(useSaveStatusStore.getState().status).toBe("error");
    expect(await adapter.peek(PERSIST_KEY)).toBe(stored.json);
  });
});

describe("leaving the page with the workspace in IndexedDB", () => {
  beforeEach(() => localStorage.clear());

  async function idbStore() {
    const local = new LocalStorageAdapter();
    const factory = new IDBFactory();
    const storage = new WorkspaceStorage(local, () =>
      bootWorkspaceStorage({ factory, local, key: PERSIST_KEY }),
    );
    let settled: unknown = "pending";
    const store = createDiagramStore(storage, undefined, (error) => {
      settled = error ?? "ok";
    });
    await vi.waitFor(() => expect(settled).toBe("ok"));
    return { store, storage };
  }

  it("on pagehide writes the pending edit to the rescue and to IndexedDB", async () => {
    const { store, storage } = await idbStore();
    store.getState().addDiagram("Last edit", "context");

    window.dispatchEvent(new Event("pagehide"));

    expect(readRescue(PERSIST_KEY)?.value).toContain("Last edit");
    const idb = storage.current;
    if (!(idb instanceof IndexedDbAdapter)) throw new Error("expected IndexedDB");
    await vi.waitFor(async () => expect(await idb.getItem(PERSIST_KEY)).toContain("Last edit"));
  });

  it("when the page is hidden writes the pending edit to IndexedDB, with no rescue", async () => {
    const { store, storage } = await idbStore();
    store.getState().addDiagram("Hidden", "context");

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    try {
      document.dispatchEvent(new Event("visibilitychange"));
    } finally {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    }

    expect(readRescue(PERSIST_KEY)).toBeNull();
    await vi.waitFor(async () => expect(await storage.getItem(PERSIST_KEY)).toContain("Hidden"));
  });
});

describe("hydrating an empty store after an early write", () => {
  it("does not migrate (and so does not mutate) the frozen in-memory state", async () => {
    const adapter = new SlowReadAdapter();
    let settled: unknown = "pending";
    const store = createDiagramStore(adapter, undefined, (error) => (settled = error ?? "ok"));
    store.getState().addDiagram("Before the read", "context");
    adapter.release();
    await vi.waitFor(() => expect(settled).toBe("ok"));
    expect(Object.values(store.getState().diagrams).map((d) => d.name)).toContain(
      "Before the read",
    );
  });
});
