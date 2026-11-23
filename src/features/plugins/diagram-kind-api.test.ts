import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { useDiagramStore } from "@/features/diagram";
import { registerDiagramKind, unregisterDiagramKind } from "@/features/diagram-kinds/registry";
import type { DiagramKindDescriptor } from "@/features/diagram-kinds/kind.types";
import type { PluginManifest } from "./plugin.types";
import { createContributionTracker, createScopedPluginApi } from "./plugin-api";
import { registerPanelContribution, unregisterPanelContribution } from "./panel-registry";
import { usePluginPanels } from "./use-plugin-contributions";

const manifest: PluginManifest = {
  id: "structura-plugin-kind-api-test",
  name: "Kind API test",
  version: "1.0.0",
  author: "Tests",
  description: "Plugin API on diagrams that have a kind",
  apiVersion: "^1.16",
  capabilities: ["diagram:read", "diagram:write", "ui:panels"],
};

const stub: DiagramKindDescriptor = {
  id: "stub-api-kind",
  label: { text: "Stub" },
  returnLabel: { text: "Back to stub" },
  creatable: true,
  elements: [],
  interaction: {
    nodesDraggable: false,
    resizable: false,
    arrangeModeChoice: false,
    recordFlows: false,
  },
  conforms: () => [],
};

beforeAll(() => registerDiagramKind(stub));
afterAll(() => unregisterDiagramKind(stub.id));

function api() {
  return createScopedPluginApi(manifest, createContributionTracker(), new InMemoryAdapter());
}

function openDiagram(kind?: string): { diagramId: string; componentId: string } {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram(`Kind ${Math.random()}`, "context", undefined, null, undefined, {
    ...(kind && { kind }),
  });
  store.openDiagram(diagram.id);
  const component = store.addComponent("system", "Alpha", null, { x: 10, y: 20 });
  return { diagramId: diagram.id, componentId: component.id };
}

const positionOf = (diagramId: string, id: string) => {
  const layout = useDiagramStore.getState().diagrams[diagramId]!.nodeLayouts[id]!;
  return { x: layout.x, y: layout.y };
};

describe("plugin API on kind diagrams (ADR-0014)", () => {
  beforeEach(() => {
    // Leave the undo cooldown behind between tests.
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
  });

  it("refuses to move a step of a diagram in its kind's editor", () => {
    const { diagramId, componentId } = openDiagram(stub.id);
    const result = api().moveComponents([{ id: componentId, x: 500, y: 500 }]);
    expect(result).toEqual({ refused: "kind_controls_layout" });
    expect(positionOf(diagramId, componentId)).toEqual({ x: 10, y: 20 });
  });

  it("applies the structure of applyChanges but not its moves", () => {
    const { diagramId, componentId } = openDiagram(stub.id);
    const result = api().applyChanges({
      add: [{ key: "b", name: "Beta", type: "system", x: 900, y: 900 }],
      connect: [{ source: componentId, target: "b" }],
      move: [{ id: componentId, x: 700, y: 700 }],
    });
    expect(result.movesRefused).toBe("kind_controls_layout");
    expect(result.idsByKey.b).toBeTruthy();
    expect(result.connectionIds[0]).toBeTruthy();
    expect(positionOf(diagramId, componentId)).toEqual({ x: 10, y: 20 });
  });

  it("moves as before on a freehand diagram and on a kind diagram edited freehand", () => {
    const free = openDiagram();
    expect(api().moveComponents([{ id: free.componentId, x: 50, y: 60 }])).toEqual({});
    expect(positionOf(free.diagramId, free.componentId)).toEqual({ x: 50, y: 60 });

    const kind = openDiagram(stub.id);
    useDiagramStore.getState().setKindMode(kind.diagramId, "freehand");
    expect(api().moveComponents([{ id: kind.componentId, x: 70, y: 80 }])).toEqual({});
    expect(positionOf(kind.diagramId, kind.componentId)).toEqual({ x: 70, y: 80 });
  });

  it("exposes the kind, mode and availability in snapshots, and nothing on freehand", () => {
    const kind = openDiagram(stub.id);
    expect(api().getDiagram(kind.diagramId)).toMatchObject({
      kind: stub.id,
      kindMode: "kind",
      kindAvailable: true,
    });
    const missing = openDiagram("acme:value-stream");
    expect(api().getDiagram(missing.diagramId)).toMatchObject({
      kind: "acme:value-stream",
      kindMode: "freehand",
      kindAvailable: false,
    });
    const free = openDiagram();
    expect("kind" in api().getDiagram(free.diagramId)!).toBe(false);
  });

  it("creates freehand diagrams", () => {
    const id = api().createDiagram({ name: "From plugin" });
    expect("kind" in useDiagramStore.getState().diagrams[id]!).toBe(false);
  });
});

describe("plugin panels scoped to kinds", () => {
  const Panel = () => null;

  afterAll(() => {
    unregisterPanelContribution("scoped");
    unregisterPanelContribution("everywhere");
  });

  it("shows a scoped panel only for its kinds, and an unscoped one everywhere", () => {
    registerPanelContribution({
      id: "scoped",
      slot: "element-inspector",
      title: "Scoped",
      component: Panel,
      appliesTo: { kinds: [stub.id] },
    });
    registerPanelContribution({
      id: "everywhere",
      slot: "element-inspector",
      title: "Everywhere",
      component: Panel,
    });

    openDiagram(stub.id);
    const onKind = renderHook(() => usePluginPanels("element-inspector"));
    expect(onKind.result.current.map((p) => p.id)).toEqual(["scoped", "everywhere"]);
    onKind.unmount();

    openDiagram();
    const onFreehand = renderHook(() => usePluginPanels("element-inspector"));
    expect(onFreehand.result.current.map((p) => p.id)).toEqual(["everywhere"]);
    onFreehand.unmount();
  });

  it("drops an invalid scope so the panel shows everywhere", () => {
    const plugin = api();
    plugin.registerPanel({
      id: "bad-scope",
      slot: "canvas-toolbar",
      title: "Bad",
      component: Panel,
      appliesTo: { kinds: "guided" as unknown as string[] },
    });
    openDiagram();
    const panels = renderHook(() => usePluginPanels("canvas-toolbar"));
    expect(panels.result.current.map((p) => p.id)).toContain("bad-scope");
    panels.unmount();
    unregisterPanelContribution("bad-scope");
  });
});
