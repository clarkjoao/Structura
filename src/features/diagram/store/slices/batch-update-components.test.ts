import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { HISTORY_COALESCE_MS } from "../store.constants";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Batch", "container");
  store.getState().openDiagram(diagram.id);
  const ids = ["A", "B", "C", "D", "E"].map(
    (name, i) => store.getState().addComponent("system", name, null, { x: i * 200, y: 0 }).id,
  );
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
  const d = () => store.getState().diagrams[diagram.id];
  return { store, ids, d };
}

describe("batchUpdateComponents", () => {
  it("writes the patch to every component", () => {
    const { store, ids, d } = setup();
    store.getState().batchUpdateComponents(ids, { tags: ["pix"] });
    for (const id of ids) expect(d().snapshot.components[id].tags).toEqual(["pix"]);
  });

  it("is one store write and one undo step, however many components", () => {
    const { store, ids, d } = setup();
    const past = store.getState().past.length;
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.getState().batchUpdateComponents(ids, { description: "shared" });
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().past.length).toBe(past + 1);
    store.getState().undo();
    for (const id of ids) expect(d().snapshot.components[id].description).not.toBe("shared");
  });

  it("skips an id that no longer exists", () => {
    const { store, ids, d } = setup();
    store.getState().batchUpdateComponents([...ids, "ghost"], { tags: ["x"] });
    expect(d().snapshot.components[ids[0]].tags).toEqual(["x"]);
    expect(d().snapshot.components.ghost).toBeUndefined();
  });

  it("does nothing, not even history, for an empty selection", () => {
    const { store } = setup();
    const past = store.getState().past.length;
    store.getState().batchUpdateComponents([], { tags: ["x"] });
    expect(store.getState().past.length).toBe(past);
  });

  it("takes a patch per component from a function", () => {
    const { store, ids, d } = setup();
    store.getState().batchUpdateComponents([ids[0]], { tags: ["core"] });
    store
      .getState()
      .batchUpdateComponents(ids, (component) => ({ tags: [...(component.tags ?? []), "pix"] }));
    expect(d().snapshot.components[ids[0]].tags).toEqual(["core", "pix"]);
    expect(d().snapshot.components[ids[1]].tags).toEqual(["pix"]);
  });
});
