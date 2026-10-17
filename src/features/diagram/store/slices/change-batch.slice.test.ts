import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDiagramStore } from "../test-utils";
import type { DiagramChange } from "./change-batch.slice";

function storeWithTwoNodes() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Batch", "container");
  store.getState().openDiagram(diagram.id);
  const api = store.getState().addComponent("container", "API", null, { x: 0, y: 0 });
  const db = store.getState().addComponent("container", "DB", null, { x: 300, y: 0 });
  const edge = store.getState().addConnection(api.id, db.id, "reads");
  // Separate the setup's checkpoints from the batch's.
  vi.advanceTimersByTime(5000);
  const snapshot = () => {
    const d = store.getState().diagrams[diagram.id]!;
    return JSON.parse(JSON.stringify({ c: d.snapshot.components, e: d.snapshot.connections }));
  };
  return { store, api, db, edgeId: edge!.id, snapshot };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("applyChangeBatch", () => {
  it("applies every change as one undo step", () => {
    const { store, api, db, edgeId, snapshot } = storeWithTwoNodes();
    const before = snapshot();
    const pastBefore = store.getState().past.length;

    const changes: DiagramChange[] = [
      { kind: "addNode", ref: "new-1", type: "container", name: "Cache", parentId: null },
      { kind: "addEdge", sourceId: api.id, targetId: "new-1", label: "reads" },
      { kind: "updateNode", id: db.id, patch: { name: "Orders DB" } },
      { kind: "removeEdge", id: edgeId },
    ];
    const result = store.getState().applyChangeBatch(changes);

    expect(result.skipped).toEqual([]);
    const cacheId = result.idByRef["new-1"]!;
    const after = snapshot();
    expect(after.c[cacheId]?.name).toBe("Cache");
    expect(after.c[db.id]?.name).toBe("Orders DB");
    expect(after.e[edgeId]).toBeUndefined();
    expect(
      Object.values(after.e).some(
        (connection) =>
          (connection as { sourceId: string; targetId: string }).sourceId === api.id &&
          (connection as { targetId: string }).targetId === cacheId,
      ),
    ).toBe(true);
    expect(store.getState().past.length).toBe(pastBefore + 1);

    vi.advanceTimersByTime(100);
    store.getState().undo();
    expect(snapshot()).toEqual(before);
  });

  it("skips changes whose target is gone and still applies the rest, in one step", () => {
    const { store, db, snapshot } = storeWithTwoNodes();
    const pastBefore = store.getState().past.length;
    const result = store.getState().applyChangeBatch([
      { kind: "removeNode", id: "ghost" },
      { kind: "updateNode", id: db.id, patch: { name: "Renamed" } },
      { kind: "removeEdge", id: "ghost-edge" },
      { kind: "addEdge", sourceId: db.id, targetId: "ghost", label: "x" },
    ]);
    expect(result.skipped).toEqual([
      { index: 0, reason: "missingNode" },
      { index: 2, reason: "missingEdge" },
      { index: 3, reason: "missingNode" },
    ]);
    expect(snapshot().c[db.id]?.name).toBe("Renamed");
    expect(store.getState().past.length).toBe(pastBefore + 1);
  });

  it("a layout written without history after the batch undoes together with it", () => {
    const { store, api, snapshot } = storeWithTwoNodes();
    const diagramId = store.getState().activeDiagramId!;
    const layoutOf = () => store.getState().diagrams[diagramId]!.nodeLayouts[api.id];
    const before = { s: snapshot(), layout: { ...layoutOf() } };
    const pastBefore = store.getState().past.length;

    store.getState().applyChangeBatch([{ kind: "updateNode", id: api.id, patch: { name: "X" } }]);
    vi.advanceTimersByTime(5000);
    store
      .getState()
      .applyAutoLayout([{ elementId: api.id, x: 900, y: 900 }], undefined, { history: false });

    expect(store.getState().past.length).toBe(pastBefore + 1);
    expect(layoutOf()?.x).toBe(900);
    vi.advanceTimersByTime(100);
    store.getState().undo();
    expect(snapshot()).toEqual(before.s);
    expect(layoutOf()?.x).toBe(before.layout.x);
  });

  it("does nothing for an empty batch", () => {
    const { store } = storeWithTwoNodes();
    const pastBefore = store.getState().past.length;
    expect(store.getState().applyChangeBatch([])).toEqual({ idByRef: {}, skipped: [] });
    expect(store.getState().past.length).toBe(pastBefore);
  });
});
