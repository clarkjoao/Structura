import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "../test-utils";

/**
 * The canvas defers the viewport write to the end of a gesture, so by the time
 * it lands the user may have opened another diagram: the write names its
 * target. And since every `set()` serialises the workspace, a viewport that did
 * not change is not written at all.
 */
function seed() {
  const store = createTestDiagramStore();
  const first = store.getState().addDiagram("First", "container");
  const second = store.getState().addDiagram("Second", "container");
  store.getState().openDiagram(first.id);
  return { store, firstId: first.id, secondId: second.id };
}

describe("updateViewport", () => {
  it("writes the active diagram when no target is given", () => {
    const { store, firstId } = seed();
    store.getState().updateViewport({ x: 10, y: 20, zoom: 0.5 });
    expect(store.getState().diagrams[firstId]!.viewport).toEqual({ x: 10, y: 20, zoom: 0.5 });
  });

  it("writes the named diagram even when another one is active", () => {
    const { store, firstId, secondId } = seed();
    const secondBefore = store.getState().diagrams[secondId]!.viewport;
    store.getState().openDiagram(secondId);
    store.getState().updateViewport({ x: 1, y: 2, zoom: 0.3 }, firstId);
    expect(store.getState().diagrams[firstId]!.viewport).toEqual({ x: 1, y: 2, zoom: 0.3 });
    expect(store.getState().diagrams[secondId]!.viewport).toEqual(secondBefore);
  });

  it("does not touch the store when the viewport is unchanged", () => {
    const { store } = seed();
    store.getState().updateViewport({ x: 5, y: 5, zoom: 1 });
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });
    store.getState().updateViewport({ x: 5, y: 5, zoom: 1 });
    unsubscribe();
    expect(notifications).toBe(0);
  });

  it("ignores a diagram that no longer exists", () => {
    const { store } = seed();
    const before = store.getState();
    store.getState().updateViewport({ x: 1, y: 1, zoom: 1 }, "missing");
    expect(store.getState()).toBe(before);
  });
});
