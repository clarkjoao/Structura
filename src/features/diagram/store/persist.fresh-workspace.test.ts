import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence/InMemoryAdapter";
import { PERSIST_DEBOUNCE_MS } from "@/lib/timing.constants";
import { createDiagramStore } from "./diagram.store";
import { buildPersistStoragePayload, PERSIST_KEY } from "./persist.config";
import type { FreshWorkspace } from "./seedWorkspace";
import { createTestDiagramStore } from "./test-utils";

/*
 * Audit R5: the demo seeds are fetched only for a workspace with nothing stored,
 * instead of being every store's synchronous initial state.
 */

function demo(): FreshWorkspace {
  const source = createTestDiagramStore();
  const diagram = source.getState().addDiagram("Demo", "context");
  const folder = source.getState().addFolder("Demo folder", null);
  return {
    diagrams: { [diagram.id]: source.getState().diagrams[diagram.id]! },
    folders: { [folder.id]: source.getState().folders[folder.id]! },
    services: {},
  };
}

async function hydrated(store: ReturnType<typeof createDiagramStore>) {
  await vi.waitFor(() => expect(store.persist.hasHydrated()).toBe(true));
}

describe("fresh workspace seeding", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => vi.useRealTimers());

  it("starts empty, and shows the demo when nothing is stored, without writing it", async () => {
    const adapter = new InMemoryAdapter();
    const setItem = vi.spyOn(adapter, "setItem");
    const seeds = demo();
    const load = vi.fn(async () => seeds);

    const store = createDiagramStore(adapter, undefined, undefined, load);
    await hydrated(store);

    expect(load).toHaveBeenCalledTimes(1);
    expect(Object.values(store.getState().diagrams).map((d) => d.name)).toEqual(["Demo"]);
    expect(Object.values(store.getState().folders).map((f) => f.name)).toEqual(["Demo folder"]);

    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS * 2);
    expect(setItem.mock.calls.filter(([key]) => key === PERSIST_KEY)).toHaveLength(0);

    // The first edit writes the demo with it, as before.
    store.getState().addDiagram("Mine", "context");
    await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS * 2);
    const written = setItem.mock.calls.filter(([key]) => key === PERSIST_KEY).pop()?.[1];
    expect(written).toContain("Demo");
    expect(written).toContain("Mine");
  });

  it("never fetches the demo when a workspace is stored, even an empty one", async () => {
    const adapter = new InMemoryAdapter();
    const empty = createTestDiagramStore();
    await adapter.setItem(
      PERSIST_KEY,
      JSON.stringify(buildPersistStoragePayload(empty.getState())),
    );
    const load = vi.fn(async () => demo());

    const store = createDiagramStore(adapter, undefined, undefined, load);
    await hydrated(store);

    expect(load).not.toHaveBeenCalled();
    expect(store.getState().diagrams).toEqual({});
  });

  it("opens an empty workspace when the demo cannot be fetched", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createDiagramStore(new InMemoryAdapter(), undefined, undefined, async () => {
      throw new Error("chunk failed");
    });
    await hydrated(store);

    expect(store.getState().diagrams).toEqual({});
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
