import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "../test-utils";

function storeWithDiagram() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Removal", "container");
  store.getState().openDiagram(diagram.id);
  return { store, diagramId: diagram.id };
}

describe("removeElements", () => {
  it("removes multiple components as a single undo step", () => {
    const { store, diagramId } = storeWithDiagram();
    const a = store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.getState().addComponent("system", "B", null, { x: 100, y: 0 });
    const c = store.getState().addComponent("system", "C", null, { x: 200, y: 0 });
    const historyBefore = store.getState().past.length;

    store.getState().removeElements([a.id, b.id], []);

    expect(store.getState().past.length).toBe(historyBefore + 1);
    const components = store.getState().diagrams[diagramId]!.snapshot.components;
    expect(components[a.id]).toBeUndefined();
    expect(components[b.id]).toBeUndefined();
    expect(components[c.id]).toBeDefined();
  });

  it("removes descendants of removed components", () => {
    const { store, diagramId } = storeWithDiagram();
    const parent = store.getState().addComponent("panel", "Parent", null, { x: 0, y: 0 });
    const child = store.getState().addComponent("system", "Child", parent.id, { x: 10, y: 10 });

    store.getState().removeElements([parent.id], []);

    const components = store.getState().diagrams[diagramId]!.snapshot.components;
    expect(components[parent.id]).toBeUndefined();
    expect(components[child.id]).toBeUndefined();
  });

  it("removes connections touching removed nodes, plus explicitly requested edges", () => {
    const { store, diagramId } = storeWithDiagram();
    const a = store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.getState().addComponent("system", "B", null, { x: 100, y: 0 });
    const c = store.getState().addComponent("system", "C", null, { x: 200, y: 0 });
    const d = store.getState().addComponent("system", "D", null, { x: 300, y: 0 });
    const abConnection = store.getState().addConnection(a.id, b.id, "uses");
    const cdConnection = store.getState().addConnection(c.id, d.id, "uses");

    store.getState().removeElements([a.id], [cdConnection.id]);

    const connections = store.getState().diagrams[diagramId]!.snapshot.connections;
    expect(connections[abConnection.id]).toBeUndefined();
    expect(connections[cdConnection.id]).toBeUndefined();
  });

  it("a single undo restores the entire batch", () => {
    const { store, diagramId } = storeWithDiagram();
    const a = store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.getState().addComponent("system", "B", null, { x: 100, y: 0 });
    const c = store.getState().addComponent("system", "C", null, { x: 200, y: 0 });

    store.getState().removeElements([a.id, b.id, c.id], []);
    expect(Object.keys(store.getState().diagrams[diagramId]!.snapshot.components)).toHaveLength(0);

    store.getState().undo();

    const components = store.getState().diagrams[diagramId]!.snapshot.components;
    expect(components[a.id]).toBeDefined();
    expect(components[b.id]).toBeDefined();
    expect(components[c.id]).toBeDefined();
  });

  it("does nothing and pushes no checkpoint when both lists are empty", () => {
    const { store } = storeWithDiagram();
    const historyBefore = store.getState().past.length;

    store.getState().removeElements([], []);

    expect(store.getState().past.length).toBe(historyBefore);
  });
});
