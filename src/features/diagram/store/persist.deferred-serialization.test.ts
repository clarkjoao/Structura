import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence/InMemoryAdapter";
import { LocalStorageAdapter } from "@/infrastructure/persistence/LocalStorageAdapter";
import { PERSIST_DEBOUNCE_MS } from "@/lib/timing.constants";
import { createDiagramStore } from "./diagram.store";
import {
  buildPersistStoragePayload,
  createDeferredJSONStorage,
  createPersistConfig,
  PERSIST_KEY,
  wrapIStoragePortWithDiagramPersistTracking,
} from "./persist.config";
import { useSaveStatusStore } from "./saveStatus.store";

/**
 * Every store `set()` hands persistence the new state. Serialising it there cost
 * a full `JSON.stringify` of the workspace per write — on a 1 MB workspace that
 * was a large share of every edit — although the I/O is debounced and only the
 * last value is ever written. Serialisation now happens once, at flush.
 */
describe("deferred workspace serialization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serializes once for a burst of writes inside one debounce window", async () => {
    const port = wrapIStoragePortWithDiagramPersistTracking(new InMemoryAdapter());
    await port.getItem(PERSIST_KEY);
    const storage = createDeferredJSONStorage<{ n: number }>(port);
    let serialized = 0;
    for (let n = 0; n < 50; n += 1) {
      const state = {
        n,
        toJSON() {
          serialized += 1;
          return { n };
        },
      };
      void storage.setItem(PERSIST_KEY, { state, version: 1 });
    }
    expect(serialized).toBe(0);

    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
    expect(serialized).toBe(1);
  });

  it("is what the diagram store's persist config uses", async () => {
    const { storage } = createPersistConfig(new InMemoryAdapter());
    await storage.getItem(PERSIST_KEY);
    let serialized = 0;
    const state = {
      toJSON() {
        serialized += 1;
        return {};
      },
    };
    void storage.setItem(PERSIST_KEY, { state: state as never, version: 1 });
    expect(serialized).toBe(0);
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
    expect(serialized).toBe(1);
  });

  it("writes exactly the payload the store would have written, with all the writes in it", async () => {
    const adapter = new InMemoryAdapter();
    const setItem = vi.spyOn(adapter, "setItem");
    const store = createDiagramStore(adapter);
    await vi.advanceTimersByTimeAsync(0); // hydration: writes before the read are dropped
    const diagram = store.getState().addDiagram("Deferred", "container");
    store.getState().openDiagram(diagram.id);
    for (let i = 0; i < 50; i += 1) {
      store.getState().addComponent("container", `C${i}`, null, { x: i, y: i });
    }
    setItem.mockClear();

    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);

    const writes = setItem.mock.calls.filter(([key]) => key === PERSIST_KEY);
    expect(writes).toHaveLength(1);
    const written = JSON.parse(writes[0]![1]) as unknown;
    expect(written).toEqual(
      JSON.parse(JSON.stringify(buildPersistStoragePayload(store.getState()))),
    );
    const components = Object.values(
      store.getState().diagrams[diagram.id]!.snapshot.components,
    ).length;
    expect(components).toBe(50);
  });

  it("reads back what it wrote", async () => {
    const port = wrapIStoragePortWithDiagramPersistTracking(new InMemoryAdapter());
    const storage = createDeferredJSONStorage<{ a: number }>(port);
    await storage.getItem(PERSIST_KEY);
    void storage.setItem(PERSIST_KEY, { state: { a: 1 }, version: 3 });
    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
    await expect(storage.getItem(PERSIST_KEY)).resolves.toEqual({ state: { a: 1 }, version: 3 });
    await expect(storage.getItem("missing")).resolves.toBeNull();
  });

  it("serializes and writes synchronously when the page is left", async () => {
    const adapter = new LocalStorageAdapter("deferred_test_");
    const port = wrapIStoragePortWithDiagramPersistTracking(adapter);
    const storage = createDeferredJSONStorage<{ last: string }>(port);
    await storage.getItem(PERSIST_KEY);
    void storage.setItem(PERSIST_KEY, { state: { last: "edit" }, version: 1 });

    window.dispatchEvent(new Event("pagehide"));

    const raw = localStorage.getItem(`deferred_test_${PERSIST_KEY}`);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ state: { last: "edit" }, version: 1 });
  });

  it("keeps the save-status transitions: pending when scheduled, saved after the flush", async () => {
    const port = wrapIStoragePortWithDiagramPersistTracking(new InMemoryAdapter());
    const storage = createDeferredJSONStorage<{ a: number }>(port);
    await storage.getItem(PERSIST_KEY);
    void storage.setItem(PERSIST_KEY, { state: { a: 2 }, version: 1 });
    expect(useSaveStatusStore.getState().status).toBe("pending");

    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
    expect(useSaveStatusStore.getState().status).toBe("saved");
  });

  it("reports a save error when serialization fails at flush time", async () => {
    const port = wrapIStoragePortWithDiagramPersistTracking(new InMemoryAdapter());
    await port.getItem(PERSIST_KEY);
    port.setItemDeferred(PERSIST_KEY, () => {
      throw new Error("cannot serialize");
    });
    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
    expect(useSaveStatusStore.getState().status).toBe("error");
  });

  it("does not report saving when a set() changes nothing that is persisted", async () => {
    const adapter = new InMemoryAdapter();
    const store = createDiagramStore(adapter);
    await vi.advanceTimersByTimeAsync(0);
    const diagram = store.getState().addDiagram("Quiet", "container");
    store.getState().openDiagram(diagram.id);
    const comp = store.getState().addComponent("container", "A", null, { x: 0, y: 0 });
    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS);
    expect(useSaveStatusStore.getState().status).toBe("saved");

    // Fields outside the persisted slice (clipboard, undo stacks, transient
    // notices) change the store but not the workspace.
    store.setState((state) => {
      state._lastLayoutWriteAt = 123;
    });
    store.getState().clearClipboard();
    expect(useSaveStatusStore.getState().status).toBe("saved");

    store.getState().updateComponent(comp.id, { name: "B" });
    expect(useSaveStatusStore.getState().status).toBe("pending");
  });
});
