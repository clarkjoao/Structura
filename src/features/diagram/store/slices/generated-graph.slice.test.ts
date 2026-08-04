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
