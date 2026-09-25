import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { PanelKind } from "@/features/diagram/enums";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import { getElement } from "@/features/elements/element.registry";
import { emptyNodeBuildContext } from "@/features/elements/node-build-context.fixture";
import { buildCardNodeData } from "./CardNode/buildCardNodeData";
import { laneAccentFor, laneAccentOf } from "./laneAccent";
import { resolveFlowAppearance } from "./ProcessNode/flowAppearance";

const TEAL = "hsl(var(--node-system))";

function lane(id: string, laneColor: string): Component {
  return {
    id,
    name: id,
    description: "",
    parentId: null,
    type: "panel",
    panelKind: PanelKind.Swimlane,
    panelColor: laneColor,
    swimlane: { orientation: "horizontal", laneColor, laneLabel: id },
  } as Component;
}

const child = (id: string, parentId: string, extra: Record<string, unknown> = {}): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId,
    type: "process-node",
    flowShape: "rectangle",
    ...extra,
  }) as unknown as Component;

function ctxFor(components: Component[]) {
  return emptyNodeBuildContext({
    resolvedComponents: Object.fromEntries(components.map((c) => [c.id, c])),
  });
}

describe("laneAccentFor", () => {
  it("passes on a lane accent chosen from the flow presets", () => {
    const components = [lane("support", TEAL), child("n", "support")];
    expect(laneAccentFor(components[1], ctxFor(components))).toBe(TEAL);
  });

  it("passes on nothing from a lane saved with a literal colour", () => {
    // Every lane before the presets: #6366f1 at creation, literal HSL from the toolbar.
    for (const legacy of ["#6366f1", "hsl(220 70% 50%)"]) {
      const components = [lane("old", legacy), child("n", "old")];
      expect(laneAccentFor(components[1], ctxFor(components)), legacy).toBeUndefined();
    }
  });

  it("passes on nothing from an ordinary panel, or at top level", () => {
    const panel = {
      id: "p",
      name: "p",
      description: "",
      parentId: null,
      type: "panel",
      panelColor: TEAL,
    } as Component;
    const components = [panel, child("n", "p"), child("top", "")];
    expect(laneAccentFor(components[1], ctxFor(components))).toBeUndefined();
    expect(laneAccentFor({ ...components[2], parentId: null }, ctxFor(components))).toBeUndefined();
  });
});

describe("inheriting a lane's accent", () => {
  it("colours a flow node with no accent of its own, and a node with one keeps it", () => {
    const components = [
      lane("stage", TEAL),
      child("plain", "stage"),
      child("own", "stage", { customColor: "hsl(var(--node-person))" }),
    ];
    const ctx = ctxFor(components);
    const descriptor = getElement("process-node")!;
    const plain = descriptor.canvas.buildData(components[1], ctx) as {
      laneAccent?: string;
      customColor?: string;
    };
    const own = descriptor.canvas.buildData(components[2], ctx) as typeof plain;
    expect(resolveFlowAppearance(plain, plain.laneAccent).accent).toBe(TEAL);
    expect(resolveFlowAppearance(own, own.laneAccent).accent).toBe("hsl(var(--node-person))");
  });

  it("writes nothing: the diagram hashes the same after the canvas is built", () => {
    const components = [lane("stage", TEAL), child("plain", "stage")];
    const surface = {
      activeVersionId: null,
      compareVersionId: null,
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: {},
      description: "",
      diagramName: "lanes",
      domain: "",
      edgeLayouts: {},
      flows: {},
      iconLibrary: {},
      nodeLayouts: {},
      versions: {},
    };
    const before = snapshotChecksum(surface);
    const json = JSON.stringify(surface);
    const ctx = ctxFor(components);
    getElement("process-node")!.canvas.buildData(components[1], ctx);
    expect(JSON.stringify(surface)).toBe(json);
    expect(snapshotChecksum(surface)).toBe(before);
    expect(components[1]).not.toHaveProperty("customColor");
  });
});

describe("a C4 system dragged into the support lane", () => {
  it("takes the lane's accent while it is in the lane, without it being stored", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Blueprint", "context");
    store.getState().openDiagram(diagram.id);
    const support = store
      .getState()
      .addComponent("panel", "Support", null, { x: 0, y: 0 }, undefined, PanelKind.Swimlane);
    store.getState().updateComponent(support.id, {
      panelColor: TEAL,
      swimlane: { orientation: "horizontal", laneColor: TEAL, laneLabel: "Support" },
    });
    const system = store.getState().addComponent("system", "Billing", null, { x: 900, y: 900 });

    store.getState().setParent(system.id, support.id);

    const state = store.getState();
    const components = state.diagrams[state.activeDiagramId!].snapshot.components;
    expect(components[system.id].parentId).toBe(support.id);
    const data = buildCardNodeData(components[system.id], ctxFor(Object.values(components)));
    expect(data.customColor).toBe(TEAL);
    expect(components[system.id]).not.toHaveProperty("customColor");
    expect(components[system.id]).not.toHaveProperty("panelColor");
  });
});

describe("laneAccentOf", () => {
  it("answers from the parent alone, for controls without a build context", () => {
    const support = lane("support", TEAL);
    const node = child("n", "support");
    expect(laneAccentOf(node, support)).toBe(TEAL);
    expect(laneAccentOf(node, undefined)).toBeUndefined();
    expect(laneAccentOf(node, lane("other", TEAL))).toBeUndefined();
  });
});
