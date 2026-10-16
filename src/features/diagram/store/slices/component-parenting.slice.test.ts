import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { NODE_DRAG_PADDING } from "../../model/layout.constants";

type Store = ReturnType<typeof createTestDiagramStore>;

/** Parenting in the base diagram and in a version scene, which keeps its own components. */
function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Parenting", "container");
  store.getState().openDiagram(diagram.id);
  const d = () => store.getState().diagrams[diagram.id];
  return { store, d, past: () => store.getState().past.length };
}

const component = (ctx: ReturnType<typeof setup>, id: string) => ctx.d().snapshot.components[id];
const layout = (ctx: ReturnType<typeof setup>, id: string) => ctx.d().nodeLayouts[id];

function openScene(store: Store) {
  const scene = store.getState().addVersion("Proposal");
  store.getState().setActiveVersion(scene.id);
  return scene;
}

describe("setParent", () => {
  it("keeps the child where it is on the canvas when it moves into a parent", () => {
    const ctx = setup();
    const panel = ctx.store.getState().addComponent("panel", "P", null, { x: 100, y: 200 });
    const node = ctx.store.getState().addComponent("system", "N", null, { x: 150, y: 260 });
    ctx.store.getState().setParent(node.id, panel.id);
    expect(layout(ctx, node.id)).toMatchObject({ x: 50, y: 60 });
  });

  it("keeps the absolute position through a nested parent chain", () => {
    const ctx = setup();
    const outer = ctx.store.getState().addComponent("panel", "Outer", null, { x: 100, y: 100 });
    const inner = ctx.store.getState().addComponent("panel", "Inner", null, { x: 130, y: 140 });
    ctx.store.getState().setParent(inner.id, outer.id); // inner is now (30, 40) in outer
    const node = ctx.store.getState().addComponent("system", "N", null, { x: 500, y: 500 });
    ctx.store.getState().setParent(node.id, inner.id);
    // absolute (500, 500) minus inner's absolute (130, 140)
    expect(layout(ctx, node.id)).toMatchObject({ x: 370, y: 360 });
    ctx.store.getState().setParent(node.id, null);
    expect(layout(ctx, node.id)).toMatchObject({ x: 500, y: 500 });
  });

  it("leaves absolute coordinates when the new parent has no layout yet", () => {
    const ctx = setup();
    const panel = ctx.store.getState().addComponent("panel", "P", null, { x: 100, y: 100 });
    const node = ctx.store.getState().addComponent("system", "N", null, { x: 400, y: 300 });
    ctx.store.setState((state) => {
      delete state.diagrams[ctx.d().id].nodeLayouts[panel.id];
    });
    ctx.store.getState().setParent(node.id, panel.id);
    expect(component(ctx, node.id).parentId).toBe(panel.id);
    expect(layout(ctx, node.id)).toMatchObject({ x: 400, y: 300 });
  });

  it("pushes history even when the parent does not change, so a reparent can be undone", () => {
    const ctx = setup();
    const node = ctx.store.getState().addComponent("system", "N", null, { x: 0, y: 0 });
    const before = ctx.past();
    ctx.store.getState().setParent(node.id, null);
    expect(ctx.past()).toBe(before + 1);
  });

  it("refuses a nesting the parent does not take, before any history", () => {
    const ctx = setup();
    const person = ctx.store.getState().addComponent("person", "Who", null, { x: 0, y: 0 });
    const node = ctx.store.getState().addComponent("system", "N", null, { x: 0, y: 100 });
    const before = ctx.past();
    ctx.store.getState().setParent(node.id, person.id);
    expect(component(ctx, node.id).parentId).toBeNull();
    expect(ctx.past()).toBe(before);
  });

  it("ignores a child that does not exist, though the checkpoint is already pushed", () => {
    const ctx = setup();
    const before = ctx.past();
    ctx.store.getState().setParent("nope", null);
    expect(ctx.past()).toBe(before + 1);
  });

  describe("inside a version scene", () => {
    it("refuses a component of the base diagram", () => {
      const ctx = setup();
      const panel = ctx.store.getState().addComponent("panel", "P", null, { x: 0, y: 0 });
      const base = ctx.store.getState().addComponent("system", "Base", null, { x: 50, y: 50 });
      openScene(ctx.store);
      ctx.store.getState().setParent(base.id, panel.id);
      expect(component(ctx, base.id).parentId).toBeNull();
    });

    it("reparents a component the scene added, and writes no history", () => {
      const ctx = setup();
      const panel = ctx.store.getState().addComponent("panel", "P", null, { x: 0, y: 0 });
      const scene = openScene(ctx.store);
      const own = ctx.store.getState().addComponent("system", "Own", null, { x: 40, y: 40 });
      const before = ctx.past();
      ctx.store.getState().setParent(own.id, panel.id);
      expect(ctx.d().versions![scene.id].addedComponents[own.id].parentId).toBe(panel.id);
      expect(ctx.past()).toBe(before);
    });
  });
});

describe("batchCommitNodeDrag", () => {
  it("does nothing when no entry names a node", () => {
    const ctx = setup();
    const before = ctx.past();
    ctx.store
      .getState()
      .batchCommitNodeDrag([{ nodeId: "ghost", newParentId: null, newPosition: { x: 1, y: 1 } }]);
    expect(ctx.past()).toBe(before);
  });

  it("leaves a node the target does not take where it was, parent and position", () => {
    const ctx = setup();
    const person = ctx.store.getState().addComponent("person", "Who", null, { x: 0, y: 0 });
    const node = ctx.store.getState().addComponent("system", "N", null, { x: 10, y: 10 });
    ctx.store
      .getState()
      .batchCommitNodeDrag([
        { nodeId: node.id, newParentId: person.id, newPosition: { x: 77, y: 88 } },
      ]);
    expect(component(ctx, node.id).parentId).toBeNull();
    // A refused nesting returns before the layout write: the node does not move either.
    expect(layout(ctx, node.id)).toMatchObject({ x: 10, y: 10 });
  });

  it("applies the entries it can when others are refused", () => {
    const ctx = setup();
    const person = ctx.store.getState().addComponent("person", "Who", null, { x: 0, y: 0 });
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 10, y: 10 });
    const b = ctx.store.getState().addComponent("system", "B", null, { x: 20, y: 20 });
    ctx.store.getState().batchCommitNodeDrag([
      { nodeId: a.id, newParentId: person.id, newPosition: { x: 1, y: 1 } },
      { nodeId: b.id, newParentId: null, newPosition: { x: 500, y: 600 } },
    ]);
    expect(layout(ctx, a.id)).toMatchObject({ x: 10, y: 10 });
    expect(layout(ctx, b.id)).toMatchObject({ x: 500, y: 600 });
  });

  it("in a scene, skips base components and moves the ones the scene added", () => {
    const ctx = setup();
    const base = ctx.store.getState().addComponent("system", "Base", null, { x: 5, y: 5 });
    const scene = openScene(ctx.store);
    const own = ctx.store.getState().addComponent("system", "Own", null, { x: 9, y: 9 });
    const before = ctx.past();
    ctx.store.getState().batchCommitNodeDrag([
      { nodeId: base.id, newParentId: null, newPosition: { x: 700, y: 700 } },
      { nodeId: own.id, newParentId: null, newPosition: { x: 300, y: 400 } },
    ]);
    expect(layout(ctx, base.id)).toMatchObject({ x: 5, y: 5 });
    expect(ctx.d().versions![scene.id].nodeLayouts[own.id]).toMatchObject({ x: 300, y: 400 });
    expect(ctx.past()).toBe(before);
  });
});

describe("groupNodes", () => {
  it("needs at least two nodes", () => {
    const ctx = setup();
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const before = ctx.past();
    expect(ctx.store.getState().groupNodes([a.id])).toBeNull();
    expect(ctx.store.getState().groupNodes([a.id, "ghost"])).toBeNull();
    expect(ctx.past()).toBe(before);
  });

  it("will not group inside a version scene", () => {
    const ctx = setup();
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = ctx.store.getState().addComponent("system", "B", null, { x: 100, y: 0 });
    openScene(ctx.store);
    expect(ctx.store.getState().groupNodes([a.id, b.id])).toBeNull();
  });

  it("draws the panel around the nodes with padding, behind them, and re-anchors them in it", () => {
    const ctx = setup();
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 100, y: 100 });
    const b = ctx.store.getState().addComponent("system", "B", null, { x: 400, y: 300 });
    const panelId = ctx.store.getState().groupNodes([a.id, b.id])!;
    const panel = layout(ctx, panelId);
    expect(panel.zIndex).toBe(-1);
    expect(panel.x).toBe(100 - NODE_DRAG_PADDING);
    expect(panel.width).toBeGreaterThan(300 + 2 * NODE_DRAG_PADDING - 1);
    // Children keep their absolute place: panel origin + relative offset.
    expect(panel.x + layout(ctx, a.id).x).toBe(100);
    expect(panel.y + layout(ctx, a.id).y).toBe(100);
    expect(panel.x + layout(ctx, b.id).x).toBe(400);
    expect(panel.y + layout(ctx, b.id).y).toBe(300);
  });

  it("measures a nested node by its absolute position", () => {
    const ctx = setup();
    const outer = ctx.store.getState().addComponent("panel", "Outer", null, { x: 1000, y: 1000 });
    const inner = ctx.store.getState().addComponent("system", "In", null, { x: 1100, y: 1100 });
    ctx.store.getState().setParent(inner.id, outer.id);
    const loose = ctx.store.getState().addComponent("system", "Loose", null, { x: 1500, y: 1500 });
    const panelId = ctx.store.getState().groupNodes([inner.id, loose.id])!;
    expect(layout(ctx, panelId).x).toBe(1100 - NODE_DRAG_PADDING);
  });

  it("leaves out an api-group, which is never grouped", () => {
    const ctx = setup();
    const group = ctx.store.getState().addComponent("api-group", "API", null, { x: 0, y: 0 });
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 100, y: 0 });
    // One eligible node is not enough to group.
    expect(ctx.store.getState().groupNodes([group.id, a.id])).toBeNull();
  });

  it("is one undo step", () => {
    const ctx = setup();
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = ctx.store.getState().addComponent("system", "B", null, { x: 200, y: 0 });
    const panelId = ctx.store.getState().groupNodes([a.id, b.id])!;
    ctx.store.getState().undo();
    expect(component(ctx, panelId)).toBeUndefined();
    expect(component(ctx, a.id).parentId).toBeNull();
  });
});

describe("ungroupNodes", () => {
  it("frees the children where they stand and removes the panel", () => {
    const ctx = setup();
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 100, y: 100 });
    const b = ctx.store.getState().addComponent("system", "B", null, { x: 400, y: 300 });
    const panelId = ctx.store.getState().groupNodes([a.id, b.id])!;
    ctx.store.getState().ungroupNodes(panelId);
    expect(component(ctx, panelId)).toBeUndefined();
    expect(layout(ctx, panelId)).toBeUndefined();
    expect(layout(ctx, a.id)).toMatchObject({ x: 100, y: 100 });
    expect(layout(ctx, b.id)).toMatchObject({ x: 400, y: 300 });
  });

  it("does nothing to a node that is not a panel", () => {
    const ctx = setup();
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const before = ctx.past();
    ctx.store.getState().ungroupNodes(a.id);
    expect(component(ctx, a.id)).toBeDefined();
    expect(ctx.past()).toBe(before);
  });

  it("is one undo step", () => {
    const ctx = setup();
    const a = ctx.store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = ctx.store.getState().addComponent("system", "B", null, { x: 200, y: 0 });
    const panelId = ctx.store.getState().groupNodes([a.id, b.id])!;
    ctx.store.getState().ungroupNodes(panelId);
    ctx.store.getState().undo();
    expect(component(ctx, panelId)).toBeDefined();
    expect(component(ctx, a.id).parentId).toBe(panelId);
  });

  it("in a scene, dissolves a panel the scene added and writes no history", () => {
    const ctx = setup();
    const scene = openScene(ctx.store);
    const panel = ctx.store.getState().addComponent("panel", "P", null, { x: 200, y: 200 });
    const child = ctx.store.getState().addComponent("system", "C", null, { x: 20, y: 30 });
    ctx.store.getState().setParent(child.id, panel.id);
    const before = ctx.past();
    ctx.store.getState().ungroupNodes(panel.id);
    const sceneState = ctx.d().versions![scene.id];
    expect(sceneState.addedComponents[panel.id]).toBeUndefined();
    expect(sceneState.addedComponents[child.id].parentId).toBeNull();
    expect(ctx.past()).toBe(before);
  });

  it("in a scene, leaves a base panel alone", () => {
    const ctx = setup();
    const panel = ctx.store.getState().addComponent("panel", "P", null, { x: 0, y: 0 });
    openScene(ctx.store);
    ctx.store.getState().ungroupNodes(panel.id);
    expect(component(ctx, panel.id)).toBeDefined();
  });
});
