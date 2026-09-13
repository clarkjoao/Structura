import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "../test-utils";

/**
 * batchUpdateNodeLayouts is the store side of the re-measure flush: one write
 * for a whole round of nodes, and no history, because syncing measured sizes is
 * not an edit the user made and must not cost an undo step.
 */
function seed() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Batch", "container");
  store.getState().openDiagram(diagram.id);
  const a = store.getState().addComponent("container", "A", null, { x: 10, y: 10 });
  const b = store.getState().addComponent("container", "B", null, { x: 20, y: 20 });
  return { store, aId: a.id, bId: b.id };
}

const layout = (store: ReturnType<typeof createTestDiagramStore>, id: string) => {
  const s = store.getState();
  return { ...s.diagrams[s.activeDiagramId!].nodeLayouts[id] };
};

describe("batchUpdateNodeLayouts", () => {
  it("applies every entry", () => {
    const { store, aId, bId } = seed();
    store.getState().batchUpdateNodeLayouts([
      { elementId: aId, position: { x: 1, y: 2 }, dimensions: { width: 100, height: 50 } },
      { elementId: bId, position: { x: 3, y: 4 } },
    ]);

    expect(layout(store, aId)).toMatchObject({ x: 1, y: 2, width: 100, height: 50 });
    expect(layout(store, bId)).toMatchObject({ x: 3, y: 4 });
  });

  it("pushes no history checkpoint", () => {
    const { store, aId } = seed();
    const before = store.getState().past.length;
    store
      .getState()
      .batchUpdateNodeLayouts([
        { elementId: aId, position: { x: 7, y: 7 }, dimensions: { width: 9, height: 9 } },
      ]);
    expect(store.getState().past.length).toBe(before);
  });

  it("leaves the store alone for an empty batch", () => {
    const { store, aId } = seed();
    const before = layout(store, aId);
    store.getState().batchUpdateNodeLayouts([]);
    expect(layout(store, aId)).toEqual(before);
  });

  it("skips ids that have no layout instead of throwing", () => {
    const { store, aId } = seed();
    expect(() =>
      store.getState().batchUpdateNodeLayouts([
        { elementId: "does-not-exist", position: { x: 0, y: 0 } },
        { elementId: aId, position: { x: 5, y: 6 } },
      ]),
    ).not.toThrow();
    expect(layout(store, aId)).toMatchObject({ x: 5, y: 6 });
  });

  it("matches updateNodeLayout entry for entry", () => {
    const one = seed();
    const many = seed();

    one.store.getState().updateNodeLayout(one.aId, { x: 42, y: 43 }, { width: 11, height: 12 });
    many.store
      .getState()
      .batchUpdateNodeLayouts([
        { elementId: many.aId, position: { x: 42, y: 43 }, dimensions: { width: 11, height: 12 } },
      ]);

    // ids differ between the two seeded stores; the layout geometry must not
    const { elementId: _a, ...viaBatch } = layout(many.store, many.aId);
    const { elementId: _b, ...viaSingle } = layout(one.store, one.aId);
    expect(viaBatch).toEqual(viaSingle);
  });
});
