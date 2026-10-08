import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { useDiagramStore } from "@/features/diagram";
import type { PluginManifest, StructuraPluginApi } from "./plugin.types";
import { STRUCTURA_PLUGIN_API_VERSION } from "./plugin.types";
import { createContributionTracker, createScopedPluginApi } from "./plugin-api";

const manifest: PluginManifest = {
  id: "structura-plugin-diagram-api-test",
  name: "Diagram API test",
  version: "1.0.0",
  author: "Tests",
  description: "Tests the v1.1 diagram read/write API",
  apiVersion: "^1.1",
  capabilities: ["diagram:read", "diagram:write"],
};

describe("v1.1 diagram read/write API", () => {
  let api: StructuraPluginApi;
  let diagramId: string;
  let componentA: string;
  let componentB: string;

  // Strictly increasing across tests: the store's undo cooldown compares Date.now()
  // against timestamps that survive between tests, so the fake clock must never rewind.
  let clockBase = Date.now();

  beforeEach(() => {
    // History checkpoints coalesce within HISTORY_COALESCE_MS and undo is
    // cooldown-throttled — fake timers make the undo semantics deterministic.
    clockBase += 100_000;
    vi.useFakeTimers({ now: clockBase });
    api = createScopedPluginApi(manifest, createContributionTracker(), new InMemoryAdapter());
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram(`API test ${Math.random()}`, "context");
    diagramId = diagram.id;
    store.openDiagram(diagramId);
    componentA = store.addComponent("system", "Alpha", null, { x: 10, y: 20 }).id;
    componentB = store.addComponent("system", "Beta", null, { x: 300, y: 20 }).id;
    vi.advanceTimersByTime(2000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes the bumped apiVersion", () => {
    expect(api.apiVersion).toBe(STRUCTURA_PLUGIN_API_VERSION);
    expect(api.apiVersion).toBe("1.7.0");
  });

  it("reads the active diagram as a detached snapshot (spec scenario)", () => {
    expect(api.getActiveDiagramId()).toBe(diagramId);

    const snapshot = api.getDiagram();
    expect(snapshot?.id).toBe(diagramId);
    const alpha = snapshot?.components.find((c) => c.id === componentA);
    expect(alpha).toMatchObject({ label: "Alpha", parentId: null });
    expect(alpha?.position).toEqual({ x: 10, y: 20 });

    // Mutating the snapshot must not reach the store.
    if (alpha) (alpha as { label: string }).label = "Hacked";
    const inStore = useDiagramStore.getState().diagrams[diagramId].snapshot.components[componentA];
    expect(inStore.name).toBe("Alpha");
  });

  it("returns null for unknown diagram ids (spec scenario)", () => {
    expect(api.getDiagram("no-such-id")).toBeNull();
  });

  it("applies undoable whitelisted patches and drops the rest (spec scenarios)", () => {
    api.updateComponent(componentA, {
      name: "Renamed",
      parentId: componentB,
    } as Parameters<StructuraPluginApi["updateComponent"]>[1]);

    const store = useDiagramStore.getState();
    const patched = store.diagrams[diagramId].snapshot.components[componentA];
    expect(patched.name).toBe("Renamed");
    expect(patched.parentId).toBeNull();

    vi.advanceTimersByTime(100);
    store.undo();
    const reverted = useDiagramStore.getState().diagrams[diagramId].snapshot.components[componentA];
    expect(reverted.name).toBe("Alpha");
  });

  it("moves a batch as one history step and ignores unknown ids (spec scenario)", () => {
    api.moveComponents([
      { id: componentA, x: 0, y: 0 },
      { id: componentB, x: 260, y: 0 },
      { id: "ghost", x: 999, y: 999 },
    ]);

    const layouts = useDiagramStore.getState().diagrams[diagramId].nodeLayouts;
    expect(layouts[componentA]).toMatchObject({ x: 0, y: 0 });
    expect(layouts[componentB]).toMatchObject({ x: 260, y: 0 });

    vi.advanceTimersByTime(100);
    useDiagramStore.getState().undo();
    const reverted = useDiagramStore.getState().diagrams[diagramId].nodeLayouts;
    expect(reverted[componentA]).toMatchObject({ x: 10, y: 20 });
    expect(reverted[componentB]).toMatchObject({ x: 300, y: 20 });
  });

  it("applies a batch of changes as one history step (API 1.4)", () => {
    const result = api.applyChanges({
      remove: [componentB, "ghost"],
      update: [{ id: componentA, name: "Alpha 2", description: "d" }],
      add: [
        { key: "p", name: "Panel", type: "panel", x: 0, y: 0, width: 400, height: 300 },
        {
          key: "db",
          name: "DB",
          type: "aws-database",
          cloudServiceId: "dynamodb",
          parentKey: "p",
          x: 40,
          y: 40,
        },
      ],
      connect: [{ source: componentA, target: "db", label: "writes" }],
    });

    const diagram = useDiagramStore.getState().diagrams[diagramId];
    expect(diagram.snapshot.components[componentB]).toBeUndefined();
    expect(diagram.snapshot.components[componentA]).toMatchObject({
      name: "Alpha 2",
      description: "d",
    });
    expect(diagram.snapshot.components[result.idsByKey.db]).toMatchObject({
      type: "aws-database",
      cloudServiceId: "dynamodb",
      parentId: result.idsByKey.p,
    });
    expect(diagram.snapshot.connections[result.connectionIds[0]!]).toMatchObject({
      sourceId: componentA,
      targetId: result.idsByKey.db,
    });

    vi.advanceTimersByTime(100);
    useDiagramStore.getState().undo();
    const reverted = useDiagramStore.getState().diagrams[diagramId].snapshot;
    expect(Object.keys(reverted.components).sort()).toEqual([componentA, componentB].sort());
    expect(reverted.components[componentA]).toMatchObject({ name: "Alpha" });
  });

  it("exposes the host code editor and folder access (API 1.4)", () => {
    expect(typeof api.ui.CodeEditor).toBe("function");
    expect(typeof api.files.isSupported()).toBe("boolean");
  });
});
