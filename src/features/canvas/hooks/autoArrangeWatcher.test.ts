import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { HISTORY_COALESCE_MS } from "@/features/diagram/store/store.constants";
import { AUTO_ARRANGE_DEBOUNCE_MS, watchAutoArrange } from "./autoArrangeWatcher";

type Store = ReturnType<typeof createTestDiagramStore>;

function setup({ automatic = true, enabled = true } = {}) {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Auto", "context");
  store.getState().openDiagram(diagram.id);
  const a = store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
  if (automatic) {
    store.getState().applyAutoLayout([{ elementId: a.id, x: 0, y: 0 }], undefined, {
      layoutSettings: { mode: "automatic" },
    });
  }
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

  let isEnabled = enabled;
  // What the canvas's automatic run writes: positions only, no checkpoint.
  const arrange = vi.fn(() => {
    const ids = Object.keys(store.getState().diagrams[diagram.id]!.snapshot.components);
    store.getState().applyAutoLayout(
      ids.map((elementId, index) => ({ elementId, x: (index + 1) * 300, y: 0 })),
      undefined,
      { history: false },
    );
  });
  const stop = watchAutoArrange({ store, arrange, isEnabled: () => isEnabled });
  return {
    store,
    diagramId: diagram.id,
    aId: a.id,
    arrange,
    stop,
    setEnabled: (value: boolean) => {
      isEnabled = value;
    },
  };
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(AUTO_ARRANGE_DEBOUNCE_MS);
}

function add(store: Store, name: string): string {
  return store.getState().addComponent("system", name, null, { x: 5, y: 5 }).id;
}

describe("watchAutoArrange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("arranges once after a structural edit comes to rest", async () => {
    const { store, arrange, stop } = setup();

    add(store, "B");
    expect(arrange).not.toHaveBeenCalled();
    await settle();

    expect(arrange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("hands on only what the edits touched", async () => {
    const { store, aId, arrange, stop } = setup();

    const b = add(store, "B");
    store.getState().addConnection(aId, b, "calls");
    await settle();

    expect(arrange).toHaveBeenCalledWith([b]);
    stop();
  });

  it("does nothing for a deletion or a connection between elements already in place", async () => {
    const { store, aId, arrange, stop } = setup();
    const b = add(store, "B");
    store.getState().addConnection(aId, b, "calls");
    await settle();
    arrange.mockClear();

    store.getState().addConnection(b, aId, "replies");
    await settle();
    store.getState().removeComponent(b);
    await settle();

    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("arranges a burst of edits once", async () => {
    const { store, aId, arrange, stop } = setup();

    const b = add(store, "B");
    await vi.advanceTimersByTimeAsync(AUTO_ARRANGE_DEBOUNCE_MS / 2);
    store.getState().addConnection(aId, b, "calls");
    await vi.advanceTimersByTimeAsync(AUTO_ARRANGE_DEBOUNCE_MS / 2);
    add(store, "C");
    await settle();

    expect(arrange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not arrange for a move or a rename", async () => {
    const { store, aId, arrange, stop } = setup();

    store.getState().updateNodeLayout(aId, { x: 999, y: 999 });
    store.getState().updateComponent(aId, { name: "Renamed" });
    await settle();

    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("joins the edit's undo step, and undo/redo do not arrange again", async () => {
    const { store, diagramId, aId, arrange, stop } = setup();
    const b = add(store, "B");
    await settle();
    expect(arrange).toHaveBeenCalledTimes(1);
    expect(store.getState().diagrams[diagramId]!.nodeLayouts[b]!.x).toBe(600);

    store.getState().undo();
    await settle();
    const undone = store.getState().diagrams[diagramId]!;
    expect(undone.snapshot.components[b]).toBeUndefined();
    expect(undone.nodeLayouts[aId]).toMatchObject({ x: 0, y: 0 });

    store.getState().redo();
    await settle();
    expect(arrange).toHaveBeenCalledTimes(1);
    expect(store.getState().future).toHaveLength(0);
    stop();
  });

  it("cancels a pending run when the edit is undone before it fires", async () => {
    const { store, arrange, stop } = setup();

    add(store, "B");
    store.getState().undo();
    await settle();

    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("does not arrange a peer's change", async () => {
    const { store, diagramId, arrange, stop } = setup();

    // What `StoreBridge.write` does: the peer's state plus the marker, in one update.
    store.setState((previous) => {
      const diagram = previous.diagrams[diagramId]!;
      const peer = { id: "peer", name: "Peer", description: "", parentId: null, type: "system" };
      return {
        ...previous,
        diagrams: {
          ...previous.diagrams,
          [diagramId]: {
            ...diagram,
            snapshot: {
              ...diagram.snapshot,
              components: {
                ...diagram.snapshot.components,
                peer,
              } as typeof diagram.snapshot.components,
            },
          },
        },
        _lastRemoteWriteAt: previous._lastRemoteWriteAt + 1,
      };
    });
    await settle();

    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("skips the run when the diagram was arranged after the edit (the assistant)", async () => {
    const { store, aId, arrange, stop } = setup();

    const b = add(store, "B");
    store.getState().applyAutoLayout([
      { elementId: aId, x: 0, y: 0 },
      { elementId: b, x: 300, y: 0 },
    ]);
    await settle();

    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("never arranges in manual mode or while the canvas cannot be edited", async () => {
    const manual = setup({ automatic: false });
    add(manual.store, "B");
    await settle();
    expect(manual.arrange).not.toHaveBeenCalled();
    manual.stop();

    const locked = setup({ enabled: false });
    add(locked.store, "B");
    await settle();
    expect(locked.arrange).not.toHaveBeenCalled();
    locked.stop();
  });

  it("does not arrange when the user switches diagrams", async () => {
    const { store, arrange, stop } = setup();
    const other = store.getState().addDiagram("Other", "context");

    store.getState().openDiagram(other.id);
    await settle();

    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("stops watching when disposed", async () => {
    const { store, arrange, stop } = setup();

    add(store, "B");
    stop();
    await settle();

    expect(arrange).not.toHaveBeenCalled();
  });
});
