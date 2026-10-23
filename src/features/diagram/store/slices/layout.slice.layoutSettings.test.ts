import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPersistStoragePayload } from "../persist.config";
import { HISTORY_COALESCE_MS } from "../store.constants";
import { createTestDiagramStore } from "../test-utils";

/**
 * Layout settings are written only by the run they shaped: a density change and
 * the arrangement it caused land in one `applyAutoLayout`, so one undo puts
 * both back.
 */

function setupDiagram() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Layout", "context");
  store.getState().openDiagram(diagram.id);
  const a = store.getState().addComponent("system", "A", null, { x: 20, y: 20 });
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
  return { store, diagramId: diagram.id, aId: a.id };
}

describe("applyAutoLayout with layout settings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the settings with the positions, and one undo restores both", () => {
    const { store, diagramId, aId } = setupDiagram();
    const before = { ...store.getState().diagrams[diagramId]!.nodeLayouts[aId]! };

    store.getState().applyAutoLayout([{ elementId: aId, x: 500, y: 600 }], undefined, {
      layoutSettings: { density: "spacious" },
    });

    const diagram = store.getState().diagrams[diagramId]!;
    expect(diagram.layoutSettings).toEqual({ density: "spacious" });
    expect(diagram.nodeLayouts[aId]!.x).toBe(500);

    store.getState().undo();

    const undone = store.getState().diagrams[diagramId]!;
    expect(undone.layoutSettings).toBeUndefined();
    expect(undone.nodeLayouts[aId]!.x).toBe(before.x);
    expect(undone.nodeLayouts[aId]!.y).toBe(before.y);

    store.getState().redo();
    expect(store.getState().diagrams[diagramId]!.layoutSettings).toEqual({ density: "spacious" });
  });

  it("is its own undo step even inside the coalescing window", () => {
    const { store, diagramId, aId } = setupDiagram();

    store.getState().applyAutoLayout([{ elementId: aId, x: 100, y: 100 }]);
    // Right after the previous run: a plain run would coalesce, a settings change must not.
    store.getState().applyAutoLayout([{ elementId: aId, x: 200, y: 200 }], undefined, {
      layoutSettings: { density: "compact" },
    });

    store.getState().undo();

    const diagram = store.getState().diagrams[diagramId]!;
    expect(diagram.layoutSettings).toBeUndefined();
    expect(diagram.nodeLayouts[aId]!.x).toBe(100);
  });

  it("stores nothing when the settings go back to the defaults", () => {
    const { store, diagramId, aId } = setupDiagram();

    store.getState().applyAutoLayout([{ elementId: aId, x: 1, y: 1 }], undefined, {
      layoutSettings: { density: "compact" },
    });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().applyAutoLayout([{ elementId: aId, x: 2, y: 2 }], undefined, {
      layoutSettings: { density: "normal" },
    });

    expect("layoutSettings" in store.getState().diagrams[diagramId]!).toBe(false);
  });

  it("leaves the stored settings alone when the run passes none", () => {
    const { store, diagramId, aId } = setupDiagram();

    store.getState().applyAutoLayout([{ elementId: aId, x: 1, y: 1 }], undefined, {
      layoutSettings: { density: "spacious", layerGap: 300 },
    });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().applyAutoLayout([{ elementId: aId, x: 2, y: 2 }]);

    expect(store.getState().diagrams[diagramId]!.layoutSettings).toEqual({
      density: "spacious",
      layerGap: 300,
    });
  });

  it("survives the round trip through what the storage port writes", () => {
    const { store, diagramId, aId } = setupDiagram();

    store.getState().applyAutoLayout([{ elementId: aId, x: 1, y: 1 }], undefined, {
      layoutSettings: { density: "compact", nodeGap: 90 },
    });

    const reopened = JSON.parse(JSON.stringify(buildPersistStoragePayload(store.getState())));
    expect(reopened.state.diagrams[diagramId].layoutSettings).toEqual({
      density: "compact",
      nodeGap: 90,
    });
  });

  it("writes no field on a diagram that was never tuned", () => {
    const { store, diagramId, aId } = setupDiagram();

    store.getState().applyAutoLayout([{ elementId: aId, x: 1, y: 1 }]);

    const reopened = JSON.parse(JSON.stringify(buildPersistStoragePayload(store.getState())));
    expect("layoutSettings" in reopened.state.diagrams[diagramId]).toBe(false);
  });

  it("joins the edit's undo step when the run pushes no checkpoint", () => {
    const { store, diagramId, aId } = setupDiagram();
    const before = { ...store.getState().diagrams[diagramId]!.nodeLayouts[aId]! };

    const b = store.getState().addComponent("system", "B", null, { x: 40, y: 40 });
    const pastAfterEdit = store.getState().past.length;
    // Later than the coalescing window: only `history: false` keeps it in the step.
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().applyAutoLayout(
      [
        { elementId: aId, x: 700, y: 0 },
        { elementId: b.id, x: 900, y: 0 },
      ],
      undefined,
      { history: false },
    );
    expect(store.getState().past.length).toBe(pastAfterEdit);

    store.getState().undo();
    const undone = store.getState().diagrams[diagramId]!;
    expect(undone.snapshot.components[b.id]).toBeUndefined();
    expect(undone.nodeLayouts[aId]!.x).toBe(before.x);

    store.getState().redo();
    const redone = store.getState().diagrams[diagramId]!;
    expect(redone.snapshot.components[b.id]).toBeDefined();
    expect(redone.nodeLayouts[aId]!.x).toBe(700);
  });
});

describe("setLayoutSettings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the mode without moving anything, as one undo step", () => {
    const { store, diagramId, aId } = setupDiagram();
    store.getState().applyAutoLayout([{ elementId: aId, x: 300, y: 300 }], undefined, {
      layoutSettings: { mode: "automatic", density: "compact" },
    });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

    store.getState().setLayoutSettings({ density: "compact" });

    const diagram = store.getState().diagrams[diagramId]!;
    expect(diagram.layoutSettings).toEqual({ density: "compact" });
    expect(diagram.nodeLayouts[aId]!.x).toBe(300);

    store.getState().undo();
    expect(store.getState().diagrams[diagramId]!.layoutSettings).toEqual({
      mode: "automatic",
      density: "compact",
    });
  });

  it("deletes the field when the settings are the defaults, and ignores a no-op", () => {
    const { store, diagramId } = setupDiagram();
    const pastBefore = store.getState().past.length;

    store.getState().setLayoutSettings({ mode: "manual" });
    expect(store.getState().past.length).toBe(pastBefore);

    store.getState().setLayoutSettings({ mode: "automatic" });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().setLayoutSettings({ mode: "manual" });
    expect("layoutSettings" in store.getState().diagrams[diagramId]!).toBe(false);
  });
});

describe("applyAutoLayout with a reading direction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the direction with the positions, and one undo restores both", () => {
    const { store, diagramId, aId } = setupDiagram();
    const before = { ...store.getState().diagrams[diagramId]!.nodeLayouts[aId]! };

    store.getState().applyAutoLayout([{ elementId: aId, x: 0, y: 900 }], undefined, {
      direction: "TB",
    });
    expect(store.getState().diagrams[diagramId]!.direction).toBe("TB");

    store.getState().undo();
    const undone = store.getState().diagrams[diagramId]!;
    expect("direction" in undone).toBe(false);
    expect(undone.nodeLayouts[aId]!.y).toBe(before.y);

    store.getState().redo();
    expect(store.getState().diagrams[diagramId]!.direction).toBe("TB");
  });

  it("stores nothing for left-to-right, the default", () => {
    const { store, diagramId, aId } = setupDiagram();

    store.getState().applyAutoLayout([{ elementId: aId, x: 1, y: 1 }], undefined, {
      direction: "TB",
    });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().applyAutoLayout([{ elementId: aId, x: 2, y: 2 }], undefined, {
      direction: "LR",
    });

    expect("direction" in store.getState().diagrams[diagramId]!).toBe(false);
    const reopened = JSON.parse(JSON.stringify(buildPersistStoragePayload(store.getState())));
    expect("direction" in reopened.state.diagrams[diagramId]).toBe(false);
  });
});
