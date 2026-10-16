import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { HISTORY_COALESCE_MS } from "../store.constants";
import type { ComponentType } from "../../model/component.types";
import { NODE_DRAG_PADDING, panelTopInset } from "../../model/layout.constants";

// History coalesces soft writes inside HISTORY_COALESCE_MS; real actions are seconds apart.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
const settle = () => vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Layout", "container");
  store.getState().openDiagram(diagram.id);
  const d = () => store.getState().diagrams[diagram.id];
  const add = (
    type: ComponentType,
    name: string,
    x: number,
    y: number,
    parentId: string | null = null,
  ) => store.getState().addComponent(type, name, parentId, { x, y });
  settle();
  return { store, diagramId: diagram.id, d, add, past: () => store.getState().past.length };
}

function openScene(store: ReturnType<typeof createTestDiagramStore>) {
  const scene = store.getState().addVersion("Proposal");
  store.getState().setActiveVersion(scene.id);
  settle();
  return scene;
}

describe("updateNodeLayout", () => {
  it("moves a node and, given dimensions, resizes it", () => {
    const ctx = setup();
    const node = ctx.add("system", "N", 10, 10);
    ctx.store.getState().updateNodeLayout(node.id, { x: 50, y: 60 });
    expect(ctx.d().nodeLayouts[node.id]).toMatchObject({ x: 50, y: 60 });
    ctx.store.getState().updateNodeLayout(node.id, { x: 1, y: 2 }, { width: 300, height: 120 });
    expect(ctx.d().nodeLayouts[node.id]).toMatchObject({ x: 1, y: 2, width: 300, height: 120 });
  });

  it("leaves the size alone when none is given", () => {
    const ctx = setup();
    const node = ctx.add("system", "N", 10, 10);
    ctx.store.getState().updateNodeLayout(node.id, { x: 0, y: 0 }, { width: 300, height: 120 });
    ctx.store.getState().updateNodeLayout(node.id, { x: 5, y: 5 });
    expect(ctx.d().nodeLayouts[node.id]).toMatchObject({ width: 300, height: 120 });
  });

  it("writes no history", () => {
    const ctx = setup();
    const node = ctx.add("system", "N", 10, 10);
    settle();
    const before = ctx.past();
    ctx.store.getState().updateNodeLayout(node.id, { x: 99, y: 99 });
    expect(ctx.past()).toBe(before);
  });

  it("stamps the canvas only when asked to, and only when something was written", () => {
    const ctx = setup();
    const node = ctx.add("system", "N", 10, 10);
    const stamp = () => ctx.store.getState()._lastLayoutWriteAt ?? 0;
    const start = stamp();
    ctx.store.getState().updateNodeLayout(node.id, { x: 1, y: 1 });
    expect(stamp()).toBe(start);
    ctx.store.getState().updateNodeLayout(node.id, { x: 2, y: 2 }, undefined, { syncCanvas: true });
    expect(stamp()).toBe(start + 1);
    ctx.store.getState().updateNodeLayout("ghost", { x: 3, y: 3 }, undefined, { syncCanvas: true });
    expect(stamp()).toBe(start + 1);
  });

  it("in a scene, writes the scene's own layout and leaves a base node's alone", () => {
    const ctx = setup();
    const base = ctx.add("system", "Base", 5, 5);
    const scene = openScene(ctx.store);
    const own = ctx.add("system", "Own", 9, 9);
    ctx.store.getState().updateNodeLayout(own.id, { x: 70, y: 80 });
    expect(ctx.d().versions![scene.id].nodeLayouts[own.id]).toMatchObject({ x: 70, y: 80 });
    // A node the scene did not add falls through to the base layout map.
    ctx.store.getState().updateNodeLayout(base.id, { x: 11, y: 12 });
    expect(ctx.d().nodeLayouts[base.id]).toMatchObject({ x: 11, y: 12 });
  });
});

describe("updateViewport", () => {
  it("stores the viewport without history", () => {
    const ctx = setup();
    const before = ctx.past();
    ctx.store.getState().updateViewport({ x: 10, y: 20, zoom: 1.5 });
    expect(ctx.d().viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
    expect(ctx.past()).toBe(before);
  });
});

describe("edge label offset and control points", () => {
  function withEdge() {
    const ctx = setup();
    const a = ctx.add("component", "A", 0, 0);
    const b = ctx.add("component", "B", 300, 0);
    const conn = ctx.store.getState().addConnection(a.id, b.id, "uses")!;
    settle();
    return { ...ctx, connId: conn.id };
  }

  it("clamps the label offset to the edge, 0 to 1", () => {
    const ctx = withEdge();
    ctx.store.getState().setEdgeLabelOffset(ctx.diagramId, ctx.connId, 3);
    expect(ctx.d().edgeLayouts[ctx.connId].labelOffset).toBe(1);
    ctx.store.getState().setEdgeLabelOffset(ctx.diagramId, ctx.connId, -2);
    expect(ctx.d().edgeLayouts[ctx.connId].labelOffset).toBe(0);
    ctx.store.getState().setEdgeLabelOffset(ctx.diagramId, ctx.connId, 0.25);
    expect(ctx.d().edgeLayouts[ctx.connId].labelOffset).toBe(0.25);
  });

  it("skips the checkpoint while a drag streams (history: false)", () => {
    const ctx = withEdge();
    const before = ctx.past();
    ctx.store.getState().setEdgeLabelOffset(ctx.diagramId, ctx.connId, 0.4, { history: false });
    expect(ctx.past()).toBe(before);
    ctx.store.getState().setEdgeLabelOffset(ctx.diagramId, ctx.connId, 0.6);
    expect(ctx.past()).toBe(before + 1);
  });

  it("ignores an unknown diagram", () => {
    const ctx = withEdge();
    const before = ctx.past();
    ctx.store.getState().setEdgeLabelOffset("nope", ctx.connId, 0.5);
    ctx.store.getState().setEdgeControlPoints("nope", ctx.connId, []);
    expect(ctx.past()).toBe(before);
  });

  it("removing a point that has no layout writes nothing", () => {
    const ctx = withEdge();
    const before = ctx.past();
    ctx.store.getState().removeEdgeControlPoint(ctx.diagramId, ctx.connId, "p1");
    expect(ctx.past()).toBe(before);
  });

  it("keeps the layout entry on reset when a label offset still lives in it", () => {
    const ctx = withEdge();
    ctx.store.getState().setEdgeLabelOffset(ctx.diagramId, ctx.connId, 0.3);
    settle();
    ctx.store
      .getState()
      .setEdgeControlPoints(ctx.diagramId, ctx.connId, [{ id: "p1", x: 10, y: 10 }]);
    settle();
    ctx.store.getState().resetEdgeControlPoints(ctx.diagramId, ctx.connId);
    expect(ctx.d().edgeLayouts[ctx.connId]).toEqual({ labelOffset: 0.3 });
  });

  it("clamps an out-of-range insert index", () => {
    const ctx = withEdge();
    ctx.store
      .getState()
      .addEdgeControlPoint(ctx.diagramId, ctx.connId, { id: "p1", x: 1, y: 1 }, 99);
    settle();
    ctx.store
      .getState()
      .addEdgeControlPoint(ctx.diagramId, ctx.connId, { id: "p0", x: 0, y: 0 }, -5);
    expect(ctx.d().edgeLayouts[ctx.connId].points!.map((p) => p.id)).toEqual(["p0", "p1"]);
  });
});

describe("bringToFront and sendToBack", () => {
  it("put a node one step above the highest, or below the lowest, z-index", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    const b = ctx.add("system", "B", 0, 100);
    const c = ctx.add("system", "C", 0, 200);
    ctx.store.getState().updateNodeLayout(b.id, { x: 0, y: 100 });
    ctx.store.setState((state) => {
      const layouts = state.diagrams[ctx.diagramId].nodeLayouts;
      layouts[a.id].zIndex = 3;
      layouts[b.id].zIndex = 7;
      layouts[c.id].zIndex = -2;
    });
    ctx.store.getState().bringToFront(a.id);
    expect(ctx.d().nodeLayouts[a.id].zIndex).toBe(8);
    ctx.store.getState().sendToBack(b.id);
    expect(ctx.d().nodeLayouts[b.id].zIndex).toBe(-3);
  });

  it("count a node without a z-index as 0", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    ctx.store.getState().bringToFront(a.id);
    expect(ctx.d().nodeLayouts[a.id].zIndex).toBe(1);
    // The node's own z-index counts, so it lands one below where it was.
    ctx.store.getState().sendToBack(a.id);
    expect(ctx.d().nodeLayouts[a.id].zIndex).toBe(0);
  });

  it("in a scene, rank a scene node against the base layouts too", () => {
    const ctx = setup();
    const base = ctx.add("system", "Base", 0, 0);
    ctx.store.setState((state) => {
      state.diagrams[ctx.diagramId].nodeLayouts[base.id].zIndex = 10;
    });
    const scene = openScene(ctx.store);
    const own = ctx.add("system", "Own", 50, 50);
    ctx.store.getState().bringToFront(own.id);
    expect(ctx.d().versions![scene.id].nodeLayouts[own.id].zIndex).toBe(11);
    ctx.store.getState().sendToBack(own.id);
    expect(ctx.d().versions![scene.id].nodeLayouts[own.id].zIndex).toBeLessThan(11);
  });
});

describe("fitGroupToChildren", () => {
  function panelWithChildren() {
    const ctx = setup();
    const panel = ctx.add("panel", "P", 100, 100);
    const a = ctx.add("system", "A", 200, 220, panel.id);
    const b = ctx.add("system", "B", 500, 400, panel.id);
    ctx.store.setState((state) => {
      const layouts = state.diagrams[ctx.diagramId].nodeLayouts;
      layouts[panel.id] = { ...layouts[panel.id], x: 100, y: 100, width: 2000, height: 2000 };
      layouts[a.id] = { ...layouts[a.id], x: 50, y: 80, width: 100, height: 60 };
      layouts[b.id] = { ...layouts[b.id], x: 300, y: 200, width: 100, height: 60 };
    });
    settle();
    return { ...ctx, panel, a, b };
  }

  it("wraps the children with padding and the header inset, and keeps them where they stood", () => {
    const ctx = panelWithChildren();
    const inset = panelTopInset(undefined);
    ctx.store.getState().fitGroupToChildren(ctx.panel.id);
    const layouts = ctx.d().nodeLayouts;
    const dx = 50 - NODE_DRAG_PADDING;
    const dy = 80 - inset;
    expect(layouts[ctx.panel.id]).toMatchObject({
      x: 100 + dx,
      y: 100 + dy,
      width: 400 - 50 + NODE_DRAG_PADDING * 2,
      height: 260 - 80 + inset + NODE_DRAG_PADDING * 2,
    });
    // Child positions are relative to the panel, shifted the other way by the same amount.
    expect(layouts[ctx.a.id]).toMatchObject({ x: 50 - dx, y: 80 - dy });
    expect(layouts[ctx.b.id]).toMatchObject({ x: 300 - dx, y: 200 - dy });
  });

  it("does not let free text size the group", () => {
    const ctx = panelWithChildren();
    const text = ctx.add("text", "Label", 0, 0, ctx.panel.id);
    ctx.store.setState((state) => {
      const layouts = state.diagrams[ctx.diagramId].nodeLayouts;
      layouts[text.id] = { ...layouts[text.id], x: -5000, y: -5000, width: 10, height: 10 };
    });
    ctx.store.getState().fitGroupToChildren(ctx.panel.id);
    expect(ctx.d().nodeLayouts[ctx.panel.id].width).toBe(400 - 50 + NODE_DRAG_PADDING * 2);
    // It stays out of the bounds, but it is a child all the same and shifts with the others.
    const inset = panelTopInset(undefined);
    expect(ctx.d().nodeLayouts[text.id]).toMatchObject({
      x: -5000 - (50 - NODE_DRAG_PADDING),
      y: -5000 - (80 - inset),
    });
  });

  it("does nothing to a collapsed panel", () => {
    const ctx = panelWithChildren();
    ctx.store.getState().updateComponent(ctx.panel.id, { collapsed: true });
    settle();
    const before = ctx.past();
    ctx.store.getState().fitGroupToChildren(ctx.panel.id);
    expect(ctx.d().nodeLayouts[ctx.panel.id]).toMatchObject({ width: 2000, height: 2000 });
    expect(ctx.past()).toBe(before);
  });

  it("does nothing to a panel with no children, or one that does not exist", () => {
    const ctx = setup();
    const empty = ctx.add("panel", "Empty", 0, 0);
    settle();
    const before = ctx.past();
    ctx.store.getState().fitGroupToChildren(empty.id);
    ctx.store.getState().fitGroupToChildren("ghost");
    expect(ctx.past()).toBe(before);
  });

  it("is one undo step", () => {
    const ctx = panelWithChildren();
    ctx.store.getState().fitGroupToChildren(ctx.panel.id);
    ctx.store.getState().undo();
    expect(ctx.d().nodeLayouts[ctx.panel.id]).toMatchObject({ width: 2000, height: 2000 });
    expect(ctx.d().nodeLayouts[ctx.a.id]).toMatchObject({ x: 50, y: 80 });
  });
});

describe("applyAutoLayout", () => {
  it("does nothing for an empty run", () => {
    const ctx = setup();
    const before = ctx.past();
    ctx.store.getState().applyAutoLayout([]);
    expect(ctx.past()).toBe(before);
  });

  it("writes position, and size only when both width and height come", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    const b = ctx.add("system", "B", 0, 100);
    ctx.store.setState((state) => {
      const layouts = state.diagrams[ctx.diagramId].nodeLayouts;
      layouts[a.id].width = 111;
      layouts[a.id].height = 222;
    });
    ctx.store.getState().applyAutoLayout([
      { elementId: a.id, x: 10, y: 20, width: 500 },
      { elementId: b.id, x: 30, y: 40, width: 300, height: 150 },
      { elementId: "ghost", x: 1, y: 1 },
    ]);
    expect(ctx.d().nodeLayouts[a.id]).toMatchObject({ x: 10, y: 20, width: 111, height: 222 });
    expect(ctx.d().nodeLayouts[b.id]).toMatchObject({ x: 30, y: 40, width: 300, height: 150 });
  });

  it("is one undo step and stamps the canvas", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    const b = ctx.add("system", "B", 0, 100);
    settle();
    const start = ctx.store.getState()._lastLayoutWriteAt ?? 0;
    const before = ctx.past();
    ctx.store.getState().applyAutoLayout([
      { elementId: a.id, x: 500, y: 500 },
      { elementId: b.id, x: 600, y: 600 },
    ]);
    expect(ctx.past()).toBe(before + 1);
    expect(ctx.store.getState()._lastLayoutWriteAt).toBe(start + 1);
    ctx.store.getState().undo();
    expect(ctx.d().nodeLayouts[a.id]).toMatchObject({ x: 0, y: 0 });
    expect(ctx.d().nodeLayouts[b.id]).toMatchObject({ x: 0, y: 100 });
  });

  it("in a scene, moves the scene's nodes in the scene and the rest in the base", () => {
    const ctx = setup();
    const base = ctx.add("system", "Base", 0, 0);
    const scene = openScene(ctx.store);
    const own = ctx.add("system", "Own", 9, 9);
    ctx.store.getState().applyAutoLayout([
      { elementId: own.id, x: 400, y: 400 },
      { elementId: base.id, x: 800, y: 800 },
    ]);
    expect(ctx.d().versions![scene.id].nodeLayouts[own.id]).toMatchObject({ x: 400, y: 400 });
    expect(ctx.d().nodeLayouts[base.id]).toMatchObject({ x: 800, y: 800 });
  });
});
