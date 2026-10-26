import { describe, expect, it } from "vitest";
import { PanelKind } from "../../enums";
import { isC4Component, isPanelComponent } from "../../model/component.guards";
import { createTestDiagramStore } from "../test-utils";
import type { GeneratedEdgeInput, GeneratedNodeInput } from "./generated-graph.slice";

/** vpc > az > subnet > ecs: three levels of containment. */
const nestedNodes: GeneratedNodeInput[] = [
  {
    externalId: "vpc",
    type: "panel",
    name: "VPC",
    parentExternalId: null,
    panelKind: PanelKind.Vpc,
    x: 100,
    y: 100,
    width: 900,
    height: 400,
  },
  {
    externalId: "az",
    type: "panel",
    name: "AZ-a",
    parentExternalId: "vpc",
    panelKind: PanelKind.AvailabilityZone,
    x: 40,
    y: 40,
    width: 800,
    height: 300,
  },
  {
    externalId: "subnet",
    type: "panel",
    name: "Private",
    parentExternalId: "az",
    panelKind: PanelKind.PrivateSubnet,
    x: 40,
    y: 40,
    width: 700,
    height: 200,
  },
  {
    externalId: "ecs",
    type: "aws-compute",
    name: "ECS",
    parentExternalId: "subnet",
    technology: "Fargate",
    x: 40,
    y: 40,
  },
];

const nestedEdges: GeneratedEdgeInput[] = [
  { sourceExternalId: "vpc", targetExternalId: "ecs", label: "hosts" },
];

function storeWithDiagram() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Generated", "container");
  store.getState().openDiagram(diagram.id);
  return { store, diagramId: diagram.id };
}

describe("insertGeneratedGraph", () => {
  it("creates every component and reports the external-id mapping", () => {
    const { store, diagramId } = storeWithDiagram();

    const result = store.getState().insertGeneratedGraph(nestedNodes, nestedEdges);

    expect(result.componentIds).toHaveLength(4);
    expect(Object.keys(result.componentIdByExternalId).sort()).toEqual([
      "az",
      "ecs",
      "subnet",
      "vpc",
    ]);

    const components = store.getState().diagrams[diagramId].snapshot.components;
    for (const id of result.componentIds) {
      expect(components[id]).toBeDefined();
    }
  });

  it("wires the containment chain through parentId", () => {
    const { store, diagramId } = storeWithDiagram();

    const { componentIdByExternalId } = store
      .getState()
      .insertGeneratedGraph(nestedNodes, nestedEdges);
    const components = store.getState().diagrams[diagramId].snapshot.components;

    expect(components[componentIdByExternalId.vpc].parentId).toBeNull();
    expect(components[componentIdByExternalId.az].parentId).toBe(componentIdByExternalId.vpc);
    expect(components[componentIdByExternalId.subnet].parentId).toBe(componentIdByExternalId.az);
    expect(components[componentIdByExternalId.ecs].parentId).toBe(componentIdByExternalId.subnet);
  });

  it("builds panels with the requested panel kind", () => {
    const { store, diagramId } = storeWithDiagram();

    const { componentIdByExternalId } = store.getState().insertGeneratedGraph(nestedNodes, []);
    const components = store.getState().diagrams[diagramId].snapshot.components;

    const vpc = components[componentIdByExternalId.vpc];
    if (!isPanelComponent(vpc)) throw new Error("expected a panel");
    expect(vpc.panelKind).toBe(PanelKind.Vpc);
  });

  it("writes the given position and size to the node layout", () => {
    const { store, diagramId } = storeWithDiagram();

    const { componentIdByExternalId } = store.getState().insertGeneratedGraph(nestedNodes, []);
    const layouts = store.getState().diagrams[diagramId].nodeLayouts;

    expect(layouts[componentIdByExternalId.subnet]).toMatchObject({
      x: 40,
      y: 40,
      width: 700,
      height: 200,
    });
    // No size given: the node keeps its intrinsic dimensions.
    expect(layouts[componentIdByExternalId.ecs]).toMatchObject({ x: 40, y: 40 });
    expect(layouts[componentIdByExternalId.ecs].width).toBeUndefined();
  });

  it("applies technology to components that support it", () => {
    const { store, diagramId } = storeWithDiagram();

    const { componentIdByExternalId } = store.getState().insertGeneratedGraph(
      [
        ...nestedNodes,
        {
          externalId: "api",
          type: "container",
          name: "API",
          parentExternalId: null,
          technology: "Node.js",
          x: 0,
          y: 0,
        },
      ],
      [],
    );
    const components = store.getState().diagrams[diagramId].snapshot.components;

    const api = components[componentIdByExternalId.api];
    if (!isC4Component(api)) throw new Error("expected a C4 component");
    expect(api.technology).toBe("Node.js");
  });

  it("creates the connections between mapped components", () => {
    const { store, diagramId } = storeWithDiagram();

    const result = store.getState().insertGeneratedGraph(nestedNodes, nestedEdges);
    const connections = store.getState().diagrams[diagramId].snapshot.connections;

    expect(result.connectionIds).toHaveLength(1);
    expect(connections[result.connectionIds[0]]).toMatchObject({
      sourceId: result.componentIdByExternalId.vpc,
      targetId: result.componentIdByExternalId.ecs,
      label: "hosts",
    });
  });

  it("skips edges whose endpoints are not part of the graph", () => {
    const { store } = storeWithDiagram();

    const result = store
      .getState()
      .insertGeneratedGraph(nestedNodes, [
        { sourceExternalId: "vpc", targetExternalId: "ghost", label: "" },
      ]);

    expect(result.connectionIds).toHaveLength(0);
  });

  it("records a single undo step for the whole graph", () => {
    const { store, diagramId } = storeWithDiagram();
    const historyBefore = store.getState().past.length;

    store.getState().insertGeneratedGraph(nestedNodes, nestedEdges);
    expect(store.getState().past.length).toBe(historyBefore + 1);

    store.getState().undo();
    expect(Object.keys(store.getState().diagrams[diagramId].snapshot.components)).toHaveLength(0);
  });

  it("does nothing without an active diagram", () => {
    const store = createTestDiagramStore();

    const result = store.getState().insertGeneratedGraph(nestedNodes, nestedEdges);

    expect(result.componentIds).toEqual([]);
    expect(result.connectionIds).toEqual([]);
  });

  it("returns an empty result for an empty graph", () => {
    const { store } = storeWithDiagram();

    expect(store.getState().insertGeneratedGraph([], [])).toEqual({
      componentIdByExternalId: {},
      componentIds: [],
      connectionIds: [],
    });
  });
});

describe("insertGeneratedGraph — linking to existing components", () => {
  const leaf = (externalId: string, parentExternalId: string | null): GeneratedNodeInput => ({
    externalId,
    type: "container",
    name: externalId,
    parentExternalId,
    x: 10,
    y: 10,
  });

  it("ignores ids outside the batch by default", () => {
    const { store, diagramId } = storeWithDiagram();
    const panel = store.getState().addComponent("panel", "Existing", null);

    const result = store
      .getState()
      .insertGeneratedGraph(
        [leaf("a", panel.id)],
        [{ sourceExternalId: "a", targetExternalId: panel.id, label: "" }],
      );

    const diagram = store.getState().diagrams[diagramId];
    expect(diagram.snapshot.components[result.componentIdByExternalId.a].parentId).toBeNull();
    expect(result.connectionIds).toEqual([]);
  });

  it("nests in and connects to existing components with linkExisting", () => {
    const { store, diagramId } = storeWithDiagram();
    const panel = store.getState().addComponent("panel", "Existing", null);
    const system = store.getState().addComponent("system", "Billing", null);

    const result = store
      .getState()
      .insertGeneratedGraph(
        [leaf("a", panel.id)],
        [{ sourceExternalId: "a", targetExternalId: system.id, label: "calls" }],
        { linkExisting: true },
      );

    const diagram = store.getState().diagrams[diagramId];
    expect(diagram.snapshot.components[result.componentIdByExternalId.a].parentId).toBe(panel.id);
    const [connectionId] = result.connectionIds;
    expect(diagram.snapshot.connections[connectionId]).toMatchObject({
      sourceId: result.componentIdByExternalId.a,
      targetId: system.id,
      label: "calls",
    });
  });

  it("lands edges between existing components alone, as one undo step", () => {
    const { store, diagramId } = storeWithDiagram();
    const a = store.getState().addComponent("system", "A", null);
    const b = store.getState().addComponent("system", "B", null);

    const result = store
      .getState()
      .insertGeneratedGraph([], [{ sourceExternalId: a.id, targetExternalId: b.id, label: "" }], {
        linkExisting: true,
      });

    expect(result.connectionIds).toHaveLength(1);
    store.getState().undo();
    expect(Object.keys(store.getState().diagrams[diagramId].snapshot.connections)).toEqual([]);
  });

  it("carries a description", () => {
    const { store, diagramId } = storeWithDiagram();
    const { componentIdByExternalId } = store
      .getState()
      .insertGeneratedGraph([{ ...leaf("a", null), description: "Orders API" }], []);
    expect(
      store.getState().diagrams[diagramId].snapshot.components[componentIdByExternalId.a]
        .description,
    ).toBe("Orders API");
  });
});

describe("applyGraphChanges", () => {
  const node = (
    externalId: string,
    parentExternalId: string | null = null,
  ): GeneratedNodeInput => ({
    externalId,
    type: "container",
    name: externalId,
    parentExternalId,
    x: 10,
    y: 10,
  });

  it("removes, updates, moves, adds and connects in one undo step", () => {
    const { store, diagramId } = storeWithDiagram();
    const keep = store.getState().addComponent("system", "Keep", null);
    const gone = store.getState().addComponent("system", "Gone", null);
    const panel = store.getState().addComponent("panel", "Panel", null);
    const snapshotBefore = JSON.stringify(store.getState().diagrams[diagramId].snapshot);

    const result = store.getState().applyGraphChanges({
      remove: [gone.id],
      update: [{ id: keep.id, name: "Kept", description: "updated", technology: "Go" }],
      move: [{ id: keep.id, x: 500, y: 600 }],
      add: [node("new", panel.id)],
      connect: [
        { sourceExternalId: "new", targetExternalId: keep.id, label: "calls" },
        { sourceExternalId: "new", targetExternalId: "ghost", label: "" },
      ],
    });

    const diagram = store.getState().diagrams[diagramId];
    const components = diagram.snapshot.components;
    expect(components[gone.id]).toBeUndefined();
    expect(components[keep.id]).toMatchObject({
      name: "Kept",
      description: "updated",
      technology: "Go",
    });
    expect(diagram.nodeLayouts[keep.id]).toMatchObject({ x: 500, y: 600 });
    const created = result.componentIdByExternalId.new;
    expect(components[created].parentId).toBe(panel.id);
    expect(result.connectionIds[1]).toBeNull();
    expect(diagram.snapshot.connections[result.connectionIds[0]!]).toMatchObject({
      sourceId: created,
      targetId: keep.id,
    });

    store.getState().undo();
    expect(JSON.stringify(store.getState().diagrams[diagramId].snapshot)).toBe(snapshotBefore);
  });

  it("skips ids that are not in the diagram", () => {
    const { store, diagramId } = storeWithDiagram();
    const keep = store.getState().addComponent("system", "Keep", null);
    store.getState().applyGraphChanges({
      remove: ["nope"],
      disconnect: ["nope"],
      update: [{ id: "nope", name: "x" }],
      move: [{ id: "nope", x: 1, y: 1 }],
    });
    expect(Object.keys(store.getState().diagrams[diagramId].snapshot.components)).toEqual([
      keep.id,
    ]);
  });

  it("sets and clears a catalog service", () => {
    const { store, diagramId } = storeWithDiagram();
    const { componentIdByExternalId } = store.getState().applyGraphChanges({
      add: [{ ...node("db"), type: "aws-database", cloudServiceId: "rds" }],
    });
    const id = componentIdByExternalId.db;
    store.getState().applyGraphChanges({ update: [{ id, cloudServiceId: "dynamodb" }] });
    expect(store.getState().diagrams[diagramId].snapshot.components[id]).toMatchObject({
      cloudServiceId: "dynamodb",
    });
    store.getState().applyGraphChanges({ update: [{ id, cloudServiceId: "" }] });
    expect(
      (store.getState().diagrams[diagramId].snapshot.components[id] as { cloudServiceId?: string })
        .cloudServiceId,
    ).toBeUndefined();
  });
});
