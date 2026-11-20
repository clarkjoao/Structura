import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { HISTORY_COALESCE_MS } from "@/features/diagram/store/store.constants";
import { registerDiagramKind, unregisterDiagramKind } from "@/features/diagram-kinds/registry";
import type { DiagramKindDescriptor } from "@/features/diagram-kinds/kind.types";
import { ARRANGED_SIGNATURE_KEY, KIND_WATCH_DEBOUNCE_MS, watchDiagramKind } from "./kindWatcher";

type Store = ReturnType<typeof createTestDiagramStore>;

const stub: DiagramKindDescriptor = {
  id: "stub-watch",
  label: { text: "Stub" },
  returnLabel: { text: "Back" },
  creatable: true,
  elements: [],
  interaction: {
    nodesDraggable: false,
    resizable: false,
    arrangeModeChoice: false,
    recordFlows: false,
  },
  conforms: () => [],
};

beforeAll(() => registerDiagramKind(stub));
afterAll(() => unregisterDiagramKind(stub.id));

async function setup() {
  const store = createTestDiagramStore();
  await vi.advanceTimersByTimeAsync(0);
  const diagram = store.getState().addDiagram("Kind", "context", undefined, null, undefined, {
    kind: stub.id,
  });
  store.getState().openDiagram(diagram.id);
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

  // The derivation names a flow after the number of components: it changes when they do.
  const derive = vi.fn((d: Parameters<NonNullable<DiagramKindDescriptor["derive"]>>[0]) => {
    const count = Object.keys(d.snapshot.components).length;
    const name = `steps:${count}`;
    if (d.snapshot.flows.derived?.name === name) return null;
    return { flows: { set: [{ id: "derived", name, mermaid: "", diagramId: d.id, steps: {} }] } };
  });
  const arrange = vi.fn((d: { id: string; snapshot: { components: Record<string, unknown> } }) => {
    const ids = Object.keys(d.snapshot.components);
    store.getState().applyAutoLayout(
      ids.map((elementId, index) => ({ elementId, x: (index + 1) * 100, y: 0 })),
      undefined,
      { history: false },
    );
  });
  const stop = watchDiagramKind({ store, derive, arrange, isEnabled: () => true });
  await settle();
  derive.mockClear();
  arrange.mockClear();
  return { store, diagramId: diagram.id, derive, arrange, stop };
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(KIND_WATCH_DEBOUNCE_MS + 1);
}

function add(store: Store, name: string): string {
  return store.getState().addComponent("system", name, null, { x: 5, y: 5 }).id;
}

describe("watchDiagramKind", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives and arranges after a local edit, inside the edit's undo step", async () => {
    const { store, diagramId, derive, arrange, stop } = await setup();
    const before = store.getState().past.length;
    const id = add(store, "A");
    await settle();

    expect(derive).toHaveBeenCalledTimes(1);
    expect(arrange).toHaveBeenCalledTimes(1);
    const d = store.getState().diagrams[diagramId]!;
    expect(d.snapshot.flows.derived?.name).toBe("steps:1");
    expect(d.nodeLayouts[id]).toMatchObject({ x: 100, y: 0 });
    expect(typeof d.kindData?.[ARRANGED_SIGNATURE_KEY]).toBe("string");
    expect(store.getState().past.length).toBe(before + 1);

    vi.advanceTimersByTime(2000);
    store.getState().undo();
    await settle();
    const undone = store.getState().diagrams[diagramId]!;
    expect(undone.snapshot.components[id]).toBeUndefined();
    // The flow as the setup derived it, before the edit.
    expect(undone.snapshot.flows.derived?.name).toBe("steps:0");
    expect(arrange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("runs for a plugin's applyChanges like for any edit", async () => {
    const { store, derive, arrange, stop } = await setup();
    store.getState().applyGraphChanges({
      add: [
        {
          externalId: "p",
          type: "system",
          name: "From plugin",
          parentExternalId: null,
          x: 0,
          y: 0,
        },
      ],
    });
    await settle();
    expect(derive).toHaveBeenCalledTimes(1);
    expect(arrange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("derives without arranging when only a label changes", async () => {
    const { store, derive, arrange, stop } = await setup();
    const id = add(store, "A");
    await settle();
    derive.mockClear();
    arrange.mockClear();
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().updateComponent(id, { name: "Renamed" });
    await settle();
    expect(derive).toHaveBeenCalledTimes(1);
    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("does nothing for a peer's change", async () => {
    const { store, derive, arrange, stop } = await setup();
    const diagramId = store.getState().activeDiagramId!;
    store.setState((state) => {
      const d = state.diagrams[diagramId]!;
      return {
        _lastRemoteWriteAt: state._lastRemoteWriteAt + 1,
        diagrams: {
          ...state.diagrams,
          [diagramId]: {
            ...d,
            snapshot: {
              ...d.snapshot,
              components: {
                ...d.snapshot.components,
                peer: { id: "peer", type: "system", name: "Peer", description: "", parentId: null },
              },
            },
          },
        },
      };
    });
    await settle();
    expect(derive).not.toHaveBeenCalled();
    expect(arrange).not.toHaveBeenCalled();
    stop();
  });

  it("does nothing in freehand mode, and arranges once on the return", async () => {
    const { store, diagramId, arrange, stop } = await setup();
    store.getState().setKindMode(diagramId, "freehand");
    add(store, "Freehand");
    await settle();
    expect(arrange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().setKindMode(diagramId, "kind");
    await settle();
    expect(arrange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("arranges a diagram written while closed when it is opened", async () => {
    const { store, diagramId, arrange, stop } = await setup();
    const other = store.getState().addDiagram("Other", "context");
    store.getState().openDiagram(other.id);
    store.getState().applyGraphChanges(
      {
        add: [{ externalId: "x", type: "system", name: "X", parentExternalId: null, x: 0, y: 0 }],
      },
      diagramId,
    );
    await settle();
    expect(arrange).not.toHaveBeenCalled();

    store.getState().openDiagram(diagramId);
    await settle();
    expect(arrange).toHaveBeenCalledTimes(1);

    // Already arranged: reopening does not run again.
    store.getState().openDiagram(other.id);
    store.getState().openDiagram(diagramId);
    await settle();
    expect(arrange).toHaveBeenCalledTimes(1);
    stop();
  });
});
