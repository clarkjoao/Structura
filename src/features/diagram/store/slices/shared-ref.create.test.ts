import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { PanelKind } from "../../enums";
import { createTestDiagramStore } from "../test-utils";

function setup() {
  const store = createTestDiagramStore();
  const d = store.getState().addDiagram("Refs", "container");
  store.getState().openDiagram(d.id);
  const s = store.getState();
  const auth = s.addComponent("container", "Auth", null, { x: 600, y: 0 });
  const orders = s.addComponent("container", "Orders", null, { x: 0, y: 300 });
  const diagram = () => store.getState().diagrams[d.id];
  const components = () => diagram().snapshot.components;
  return { store, auth, orders, diagram, components };
}

describe("addSharedRef", () => {
  it("creates a reference where asked and makes the original shared, in one undo step", () => {
    const ctx = setup();
    const before = ctx.store.getState()._lastLayoutWriteAt;
    const ref = ctx.store.getState().addSharedRef(ctx.auth.id, null, { x: 240, y: 300 })!;
    expect(ctx.components()[ref.id]).toMatchObject({
      type: "shared-ref",
      refOf: ctx.auth.id,
      name: "Auth",
    });
    expect(ctx.diagram().nodeLayouts[ref.id]).toMatchObject({ x: 240, y: 300 });
    expect(ctx.components()[ctx.auth.id].shared).toEqual({ mode: "ref" });
    // The canvas drops its local copy, so a node dragged to make it goes back.
    expect(ctx.store.getState()._lastLayoutWriteAt).toBe(before + 1);

    ctx.store.getState().undo();
    expect(ctx.components()[ref.id]).toBeUndefined();
    expect(ctx.components()[ctx.auth.id].shared).toBeUndefined();
  });

  it("leaves a badge-mode original in badge mode", () => {
    const ctx = setup();
    ctx.store.getState().updateComponent(ctx.auth.id, { shared: { mode: "badge" } });
    ctx.store.getState().addSharedRef(ctx.auth.id, null, { x: 0, y: 0 });
    expect(ctx.components()[ctx.auth.id].shared).toEqual({ mode: "badge" });
  });

  it("is never made of a reference, only of the original", () => {
    const ctx = setup();
    const first = ctx.store.getState().addSharedRef(ctx.auth.id, null, { x: 0, y: 0 })!;
    const count = Object.keys(ctx.components()).length;
    expect(ctx.store.getState().addSharedRef(first.id, null, { x: 0, y: 100 })).toBeNull();
    expect(Object.keys(ctx.components())).toHaveLength(count);
  });

  it("goes in a parent that takes it, at the top level otherwise", () => {
    const ctx = setup();
    const panel = ctx.store
      .getState()
      .addComponent("panel", "Zone", null, { x: 0, y: 0 }, undefined, PanelKind.Default);
    const inside = ctx.store.getState().addSharedRef(ctx.auth.id, panel.id, { x: 10, y: 10 })!;
    expect(ctx.components()[inside.id].parentId).toBe(panel.id);
  });

  it("refuses what nothing uses: a note, a panel", () => {
    const ctx = setup();
    const note = ctx.store.getState().addComponent("note", "N", null, { x: 0, y: 0 });
    const panel = ctx.store.getState().addComponent("panel", "P", null, { x: 0, y: 0 });
    const count = Object.keys(ctx.components()).length;
    expect(ctx.store.getState().addSharedRef(note.id, null, { x: 0, y: 0 })).toBeNull();
    expect(ctx.store.getState().addSharedRef(panel.id, null, { x: 0, y: 0 })).toBeNull();
    expect(Object.keys(ctx.components())).toHaveLength(count);
  });
});

describe("routeConnectionThroughRef", () => {
  it("ends the edge on a new reference beside its source, keeping the edge", () => {
    const ctx = setup();
    const edge = ctx.store.getState().addConnection(ctx.orders.id, ctx.auth.id, "gRPC")!;
    const ref = ctx.store.getState().routeConnectionThroughRef(edge.id)!;

    const connection = ctx.diagram().snapshot.connections[edge.id];
    expect(connection).toMatchObject({ sourceId: ctx.orders.id, targetId: ref.id, label: "gRPC" });
    expect(ctx.components()[ref.id]).toMatchObject({ refOf: ctx.auth.id });
    expect(ctx.components()[ctx.auth.id].shared).toEqual({ mode: "ref" });

    // To the right of the source (edges leave on the right), centred on it.
    const source = ctx.diagram().nodeLayouts[ctx.orders.id];
    const placed = ctx.diagram().nodeLayouts[ref.id];
    expect(placed.x).toBeGreaterThan(source.x + (source.width ?? 0));
    expect(placed.y + (placed.height ?? 0) / 2).toBeCloseTo(source.y + (source.height ?? 0) / 2);

    ctx.store.getState().undo();
    expect(ctx.diagram().snapshot.connections[edge.id].targetId).toBe(ctx.auth.id);
    expect(ctx.components()[ref.id]).toBeUndefined();
  });

  it("drops the bends drawn for the old path", () => {
    const ctx = setup();
    const edge = ctx.store.getState().addConnection(ctx.orders.id, ctx.auth.id, "")!;
    const diagramId = ctx.diagram().id;
    ctx.store.getState().setEdgeControlPoints(diagramId, edge.id, [{ id: "p", x: 300, y: 100 }]);
    expect(ctx.diagram().edgeLayouts[edge.id]?.points).toHaveLength(1);
    ctx.store.getState().routeConnectionThroughRef(edge.id);
    expect(ctx.diagram().edgeLayouts[edge.id]?.points).toBeUndefined();
  });

  it("does nothing for an edge already on a reference", () => {
    const ctx = setup();
    const edge = ctx.store.getState().addConnection(ctx.orders.id, ctx.auth.id, "")!;
    const ref = ctx.store.getState().routeConnectionThroughRef(edge.id)!;
    expect(ctx.store.getState().routeConnectionThroughRef(edge.id)).toBeNull();
    expect(ctx.diagram().snapshot.connections[edge.id].targetId).toBe(ref.id);
  });

  it("puts the reference beside a source nested in a parent, in the parent's coordinates", () => {
    const ctx = setup();
    const panel = ctx.store
      .getState()
      .addComponent("panel", "Zone", null, { x: 1000, y: 1000 }, undefined, PanelKind.Default);
    const inner = ctx.store
      .getState()
      .addComponent("container", "Inner", panel.id, { x: 20, y: 40 });
    const edge = ctx.store.getState().addConnection(inner.id, ctx.auth.id, "")!;
    const ref = ctx.store.getState().routeConnectionThroughRef(edge.id)!;
    expect(ctx.components()[ref.id].parentId).toBe(panel.id);
    const innerLayout = ctx.diagram().nodeLayouts[inner.id];
    expect(ctx.diagram().nodeLayouts[ref.id].x).toBe(innerLayout.x + (innerLayout.width ?? 0) + 48);
  });
});
