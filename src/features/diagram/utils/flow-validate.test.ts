import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "../model/diagram.types";
import type { Flow } from "../model/flow.types";
import { validateFlowGraph } from "./flow-traversal";

function component(id: string): Component {
  return { id, name: id, type: "component", parentId: null } as Component;
}

function connection(id: string, sourceId: string, targetId: string): Connection {
  return { id, sourceId, targetId, label: id } as Connection;
}

/** One base diagram: two components and the connection between them. */
function makeDiagram(): Diagram {
  return {
    id: "d1",
    name: "D",
    level: "context",
    snapshot: {
      components: { c1: component("c1"), c2: component("c2") },
      connections: { n1: connection("n1", "c1", "c2") },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    scenes: {},
    activeSceneId: null,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Diagram;
}

function withScene(
  diagram: Diagram,
  scene: {
    removedComponentIds?: string[];
    removedConnectionIds?: string[];
    addedComponents?: Record<string, Component>;
    addedConnections?: Record<string, Connection>;
  },
): Diagram {
  const next = structuredClone(diagram);
  next.scenes = {
    s1: {
      id: "s1",
      name: "Scene",
      color: "#000",
      createdAt: 0,
      addedComponents: scene.addedComponents ?? {},
      addedConnections: scene.addedConnections ?? {},
      removedComponentIds: scene.removedComponentIds ?? [],
      removedConnectionIds: scene.removedConnectionIds ?? [],
      nodeLayouts: {},
    },
  };
  next.activeSceneId = "s1";
  return next;
}

function flowOver(componentIds: string[], connectionId?: string): Flow {
  const steps: Flow["steps"] = {};
  componentIds.forEach((componentId, i) => {
    const id = `s${i + 1}`;
    steps[id] = {
      id,
      type: "action",
      componentId,
      ...(i + 1 < componentIds.length ? { next: `s${i + 2}` } : {}),
      ...(connectionId && i === 0 ? { connectionId } : {}),
    };
  });
  return { id: "f1", name: "F", mermaid: "", diagramId: "d1", steps, entryStepId: "s1" };
}

describe("a flow's references are checked against the model, not the view", () => {
  it("reports nothing when every element is there", () => {
    expect(validateFlowGraph(flowOver(["c1", "c2"]), makeDiagram())).toEqual([]);
  });

  it("reports a component that is in no scene and not in the base either", () => {
    const broken = validateFlowGraph(flowOver(["c1", "ghost"]), makeDiagram());
    expect(broken).toHaveLength(1);
    expect(broken[0]!.stepId).toBe("s2");
    expect(broken[0]!.reason).toBe("component_deleted");
    expect(broken[0]!.missingId).toBe("ghost");
  });

  it("says nothing about a base component the scene has taken out of view", () => {
    const diagram = withScene(makeDiagram(), { removedComponentIds: ["c2"] });
    expect(validateFlowGraph(flowOver(["c1", "c2"]), diagram)).toEqual([]);
  });

  it("still reports a component missing from the base while a scene is in view", () => {
    const diagram = withScene(makeDiagram(), { removedComponentIds: ["c2"] });
    const broken = validateFlowGraph(flowOver(["c1", "ghost"]), diagram);
    expect(broken.map((b) => b.missingId)).toEqual(["ghost"]);
  });

  it("says nothing about a component the scene itself added", () => {
    const diagram = withScene(makeDiagram(), { addedComponents: { sc1: component("sc1") } });
    expect(validateFlowGraph(flowOver(["c1", "sc1"]), diagram)).toEqual([]);
  });

  it("reports a scene-only component once the scene drops it, since the base never held it", () => {
    const diagram = withScene(makeDiagram(), {});
    const broken = validateFlowGraph(flowOver(["c1", "sc1"]), diagram);
    expect(broken.map((b) => b.missingId)).toEqual(["sc1"]);
  });

  it("says nothing about a base connection the scene has taken out of view", () => {
    const diagram = withScene(makeDiagram(), { removedConnectionIds: ["n1"] });
    expect(validateFlowGraph(flowOver(["c1", "c2"], "n1"), diagram)).toEqual([]);
  });

  it("says nothing about a connection the scene itself added", () => {
    const diagram = withScene(makeDiagram(), {
      addedConnections: { sn1: connection("sn1", "c1", "c2") },
    });
    expect(validateFlowGraph(flowOver(["c1", "c2"], "sn1"), diagram)).toEqual([]);
  });

  it("reports a connection that is in neither the view nor the base", () => {
    const diagram = withScene(makeDiagram(), { removedConnectionIds: ["n1"] });
    const broken = validateFlowGraph(flowOver(["c1", "c2"], "gone"), diagram);
    expect(broken.map((b) => b.reason)).toEqual(["connection_deleted"]);
    expect(broken.map((b) => b.missingId)).toEqual(["gone"]);
  });
});
