import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "../test-utils";

/**
 * One drag gesture is one undo step.
 *
 * commitNodeDrag and batchCommitNodeDrag both push a STRUCTURAL checkpoint, and
 * structural checkpoints are exempt from coalescing, so a gesture that called
 * both cost the user two Ctrl+Z. Routing a whole gesture through one
 * batchCommitNodeDrag keeps it at one.
 */
function seed() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Drag", "container");
  store.getState().openDiagram(diagram.id);
  const panel = store.getState().addComponent("panel", "Panel", null, { x: 100, y: 100 });
  const a = store.getState().addComponent("container", "A", null, { x: 10, y: 10 });
  const b = store.getState().addComponent("container", "B", null, { x: 20, y: 20 });
  return { store, diagramId: diagram.id, panelId: panel.id, aId: a.id, bId: b.id };
}

const read = (store: ReturnType<typeof createTestDiagramStore>, id: string) => {
  const s = store.getState();
  const d = s.diagrams[s.activeDiagramId!];
  return { parentId: d.snapshot.components[id].parentId ?? null, layout: { ...d.nodeLayouts[id] } };
};

describe("drag commit history", () => {
  it("pushes exactly one checkpoint for a whole multi-node gesture", () => {
    const { store, panelId, aId, bId } = seed();
    const before = store.getState().past.length;

    store.getState().batchCommitNodeDrag([
      { nodeId: aId, newParentId: panelId, newPosition: { x: 5, y: 5 } },
      { nodeId: bId, newParentId: null, newPosition: { x: 900, y: 900 } },
    ]);

    expect(store.getState().past.length).toBe(before + 1);
  });

  it("undo reverts position and parentId for every node in the gesture", () => {
    const { store, panelId, aId, bId } = seed();
    const aBefore = read(store, aId);
    const bBefore = read(store, bId);

    store.getState().batchCommitNodeDrag([
      { nodeId: aId, newParentId: panelId, newPosition: { x: 5, y: 5 } },
      { nodeId: bId, newParentId: null, newPosition: { x: 900, y: 900 } },
    ]);

    expect(read(store, aId).parentId).toBe(panelId);
    expect(read(store, aId).layout.x).toBe(5);
    expect(read(store, bId).layout.x).toBe(900);

    store.getState().undo();

    expect(read(store, aId).parentId).toBe(aBefore.parentId);
    expect(read(store, aId).layout.x).toBe(aBefore.layout.x);
    expect(read(store, aId).layout.y).toBe(aBefore.layout.y);
    expect(read(store, bId).layout.x).toBe(bBefore.layout.x);
    expect(read(store, bId).layout.y).toBe(bBefore.layout.y);
  });

  it("redo puts the whole gesture back", () => {
    const { store, panelId, aId, bId } = seed();

    store.getState().batchCommitNodeDrag([
      { nodeId: aId, newParentId: panelId, newPosition: { x: 5, y: 5 } },
      { nodeId: bId, newParentId: null, newPosition: { x: 900, y: 900 } },
    ]);
    store.getState().undo();
    store.getState().redo();

    expect(read(store, aId).parentId).toBe(panelId);
    expect(read(store, aId).layout.x).toBe(5);
    expect(read(store, bId).layout.x).toBe(900);
  });

  it("a gesture that only moves nodes is still one checkpoint", () => {
    const { store, aId, bId } = seed();
    const before = store.getState().past.length;

    store.getState().batchCommitNodeDrag([
      { nodeId: aId, newParentId: null, newPosition: { x: 111, y: 111 } },
      { nodeId: bId, newParentId: null, newPosition: { x: 222, y: 222 } },
    ]);

    expect(store.getState().past.length).toBe(before + 1);
    expect(read(store, aId).layout.x).toBe(111);
    expect(read(store, bId).layout.x).toBe(222);
  });

  it("an empty gesture writes nothing and pushes nothing", () => {
    const { store } = seed();
    const before = store.getState().past.length;
    store.getState().batchCommitNodeDrag([]);
    expect(store.getState().past.length).toBe(before);
  });
});
