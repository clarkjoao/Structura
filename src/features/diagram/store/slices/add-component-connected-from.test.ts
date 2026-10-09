import { describe, expect, it } from "vitest";
import { EdgeStyle } from "../../enums";
import { createTestDiagramStore } from "../test-utils";

/**
 * Dropping a connection on empty canvas and picking an element creates a node
 * and the edge to it. The user did one thing, so undo must take back both at
 * once — which two separate `addComponent` + `addConnection` calls could not
 * promise: each pushed its own checkpoint.
 */

function seed() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("connected", "container");
  store.getState().openDiagram(diagram.id);
  const source = store.getState().addComponent("system", "Checkout", null, { x: 0, y: 0 });
  return { store, diagramId: diagram.id, sourceId: source.id };
}

describe("addComponentConnectedFrom", () => {
  it("creates the node and the edge with one history checkpoint", () => {
    const { store, diagramId, sourceId } = seed();
    const before = store.getState().past.length;

    const { component, connection } = store.getState().addComponentConnectedFrom(
      sourceId,
      {
        type: "aws-integration",
        name: "Amazon SQS",
        position: { x: 300, y: 40 },
        serviceId: "sqs",
      },
      { label: "uses", edgeStyle: EdgeStyle.Smoothstep, sides: { sourceSide: "bottom" } },
    );

    expect(store.getState().past.length).toBe(before + 1);
    const d = store.getState().diagrams[diagramId]!;
    expect(d.snapshot.components[component.id]?.type).toBe("aws-integration");
    expect(d.nodeLayouts[component.id]).toMatchObject({ x: 300, y: 40 });
    expect(connection).not.toBeNull();
    expect(d.snapshot.connections[connection!.id]).toMatchObject({
      sourceId,
      targetId: component.id,
      label: "uses",
      style: { edgeStyle: EdgeStyle.Smoothstep },
      sourceSide: "bottom",
    });
  });

  it("one undo removes both the node and the edge, and keeps the source", () => {
    const { store, diagramId, sourceId } = seed();
    const { component, connection } = store
      .getState()
      .addComponentConnectedFrom(
        sourceId,
        { type: "container", name: "Worker", position: { x: 300, y: 0 } },
        { label: "uses" },
      );

    store.getState().undo();

    const d = store.getState().diagrams[diagramId]!;
    expect(d.snapshot.components[component.id]).toBeUndefined();
    expect(d.snapshot.connections[connection!.id]).toBeUndefined();
    expect(d.snapshot.components[sourceId]).toBeDefined();
  });

  it("creates the node and no edge when nothing may leave the source", () => {
    const { store, diagramId } = seed();
    const note = store.getState().addComponent("note", "", null, { x: 0, y: 200 });
    const { component, connection } = store
      .getState()
      .addComponentConnectedFrom(
        note.id,
        { type: "system", name: "Target", position: { x: 300, y: 200 } },
        { label: "uses" },
      );

    expect(connection).toBeNull();
    const d = store.getState().diagrams[diagramId]!;
    expect(d.snapshot.components[component.id]).toBeDefined();
    expect(Object.values(d.snapshot.connections)).toHaveLength(0);
  });

  it("writes into the active scene, without a checkpoint, like its two halves do", () => {
    const { store, diagramId, sourceId } = seed();
    const version = store.getState().addVersion("Proposal");
    store.getState().setActiveVersion(version.id);
    const before = store.getState().past.length;

    const { component, connection } = store
      .getState()
      .addComponentConnectedFrom(
        sourceId,
        { type: "container", name: "Worker", position: { x: 300, y: 0 } },
        { label: "uses" },
      );

    const d = store.getState().diagrams[diagramId]!;
    const scene = d.versions![version.id]!;
    expect(scene.addedComponents[component.id]).toBeDefined();
    expect(scene.addedConnections[connection!.id]).toBeDefined();
    expect(d.snapshot.components[component.id]).toBeUndefined();
    expect(store.getState().past.length).toBe(before);
  });
});
