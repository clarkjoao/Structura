import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "@/features/diagram";
import type { FlowStep } from "@/features/diagram";
import { describeStepElement } from "./flowState";

/**
 * Which of the two blank canvases the reader is looking at.
 *
 * A scene hides base elements instead of deleting them, so a step whose node
 * the scene took out of view lights up nothing — exactly like a step whose
 * node was deleted. These say which is which. Nothing here decides anything
 * about the scene; it only reads the model.
 */

const component = (id: string) => ({ id, name: id, type: "component" }) as Component;
const connection = (id: string) => ({ id, sourceId: "c1", targetId: "c2" }) as Connection;

function diagramOf(scenes: Diagram["scenes"], activeSceneId: string | null = null): Diagram {
  return {
    id: "d1",
    name: "D",
    level: "context",
    snapshot: {
      components: { c1: component("c1"), c2: component("c2") },
      connections: { n1: connection("n1") },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    scenes,
    activeSceneId,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Diagram;
}

function scene(
  id: string,
  name: string,
  diff: Partial<{
    removedComponentIds: string[];
    removedConnectionIds: string[];
    addedComponents: Record<string, Component>;
    addedConnections: Record<string, Connection>;
  }> = {},
) {
  return {
    [id]: {
      id,
      name,
      color: "#000",
      createdAt: 0,
      addedComponents: diff.addedComponents ?? {},
      addedConnections: diff.addedConnections ?? {},
      removedComponentIds: diff.removedComponentIds ?? [],
      removedConnectionIds: diff.removedConnectionIds ?? [],
      nodeLayouts: {},
    },
  } as unknown as Diagram["scenes"];
}

const stepOn = (componentId: string): FlowStep => ({ id: "s1", type: "action", componentId });
const stepVia = (connectionId: string): FlowStep => ({ id: "s1", type: "action", connectionId });

describe("the reading says why the canvas has nothing to light up", () => {
  it("says nothing when the element is right there", () => {
    expect(describeStepElement(stepOn("c1"), diagramOf({}, null))).toEqual({ kind: "present" });
  });

  it("says nothing for a step that points at no element at all", () => {
    const step: FlowStep = { id: "s1", type: "action", note: "just a remark" };
    expect(describeStepElement(step, diagramOf({}, null))).toEqual({ kind: "present" });
  });

  it("names the scene that is hiding a base node", () => {
    const diagram = diagramOf(scene("sc1", "Q3 proposal", { removedComponentIds: ["c1"] }), "sc1");
    expect(describeStepElement(stepOn("c1"), diagram)).toEqual({
      kind: "hidden",
      sceneName: "Q3 proposal",
    });
  });

  it("names the scene that is hiding an edge", () => {
    const diagram = diagramOf(scene("sc1", "Q3 proposal", { removedConnectionIds: ["n1"] }), "sc1");
    expect(describeStepElement(stepVia("n1"), diagram)).toEqual({
      kind: "hidden",
      sceneName: "Q3 proposal",
    });
  });

  it("names the scene that is open, not merely the first one on the diagram", () => {
    const diagram = diagramOf(
      {
        ...scene("sc1", "Rollout"),
        ...scene("sc2", "Q3 proposal", { removedComponentIds: ["c1"] }),
      },
      "sc2",
    );
    expect(describeStepElement(stepOn("c1"), diagram)).toEqual({
      kind: "hidden",
      sceneName: "Q3 proposal",
    });
  });

  it("calls a node that is in no scene and no base gone", () => {
    expect(describeStepElement(stepOn("ghost"), diagramOf({}, null))).toEqual({ kind: "gone" });
  });

  it("does not call a node gone when another scene still holds it", () => {
    const diagram = diagramOf(
      scene("sc1", "Rollout", { addedComponents: { own: component("own") } }),
      null,
    );
    expect(describeStepElement(stepOn("own"), diagram)).toEqual({
      kind: "elsewhere",
      sceneName: "Rollout",
    });
  });

  it("says nothing about a node the open scene itself added", () => {
    const diagram = diagramOf(
      scene("sc1", "Rollout", { addedComponents: { own: component("own") } }),
      "sc1",
    );
    expect(describeStepElement(stepOn("own"), diagram)).toEqual({ kind: "present" });
  });

  it("says nothing about a base node while a scene that hides something else is open", () => {
    const diagram = diagramOf(scene("sc1", "Q3 proposal", { removedComponentIds: ["c2"] }), "sc1");
    expect(describeStepElement(stepOn("c1"), diagram)).toEqual({ kind: "present" });
  });

  it("does not confuse a hidden edge for a hidden node", () => {
    const diagram = diagramOf(scene("sc1", "Q3 proposal", { removedComponentIds: ["c1"] }), "sc1");
    expect(describeStepElement(stepVia("n1"), diagram)).toEqual({ kind: "present" });
  });

  it("reports every kind for the step it was asked about, not some other step", () => {
    const diagram = diagramOf(scene("sc1", "Q3 proposal", { removedComponentIds: ["c1"] }), "sc1");
    expect([
      describeStepElement(stepOn("c1"), diagram).kind,
      describeStepElement(stepOn("c2"), diagram).kind,
      describeStepElement(stepOn("ghost"), diagram).kind,
    ]).toEqual(["hidden", "present", "gone"]);
  });

  it("says nothing when there is no step or no diagram to read", () => {
    expect(describeStepElement(null, diagramOf({}, null))).toEqual({ kind: "present" });
    expect(describeStepElement(stepOn("c1"), null)).toEqual({ kind: "present" });
  });
});
