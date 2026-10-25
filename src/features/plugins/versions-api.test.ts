/**
 * Plugin API 1.14: plugins own Versions by key, read what the canvas shows, and get the user's
 * actions on their Versions instead of the store changing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { useDiagramStore } from "@/features/diagram";
import type { PluginManifest, PluginVersionAction, StructuraPluginApi } from "./plugin.types";
import { createContributionTracker, createScopedPluginApi } from "./plugin-api";
import { deliverVersionAction, pluginHandlesVersionActions } from "./version-actions";

const manifest: PluginManifest = {
  id: "structura-plugin-versions-test",
  name: "Versions test",
  version: "1.0.0",
  author: "Tests",
  description: "Tests api.versions",
  apiVersion: "^1.14",
  capabilities: ["diagram:read", "diagram:write"],
};

describe("api.versions", () => {
  let api: StructuraPluginApi;
  let diagramId: string;
  let apiId: string;
  let dbId: string;
  let clockBase = Date.now();

  beforeEach(() => {
    clockBase += 100_000;
    vi.useFakeTimers({ now: clockBase });
    api = createScopedPluginApi(manifest, createContributionTracker(), new InMemoryAdapter());
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram(`Versions ${Math.random()}`, "container");
    diagramId = diagram.id;
    store.openDiagram(diagramId);
    apiId = store.addComponent("system", "API", null, { x: 0, y: 0 }).id;
    dbId = store.addComponent("system", "DB", null, { x: 300, y: 0 }).id;
    vi.advanceTimersByTime(2000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const diagram = () => useDiagramStore.getState().diagrams[diagramId]!;

  it("upserts one owned Version per key, its content replaced each time", () => {
    const first = api.versions.upsert({
      key: "remote-sessions",
      name: "Remote sessions",
      status: "approved",
      diff: { modify: [{ id: apiId, name: "API v2" }] },
    });
    const second = api.versions.upsert({
      key: "remote-sessions",
      name: "Remote sessions",
      status: "in-progress",
      diff: {
        remove: [dbId],
        add: [{ key: "store", type: "system", name: "Store", x: 0, y: 200 }],
      },
    });
    expect(second).toBe(first);
    const [snapshot] = api.versions.list();
    expect(snapshot).toMatchObject({
      key: "remote-sessions",
      status: "in-progress",
      ownerPluginId: manifest.id,
      modified: { componentIds: [], connectionIds: [] },
      removed: { componentIds: [dbId], connectionIds: [] },
      conflicts: [],
    });
    expect(snapshot!.added.componentIds).toHaveLength(1);
    expect(diagram().snapshot.components[dbId]).toBeDefined();
  });

  it("reads the active Version in getDiagram, and the base on request", () => {
    api.versions.upsert({
      key: "plan",
      name: "Plan",
      diff: { modify: [{ id: apiId, name: "API v2" }] },
    });
    api.versions.setActive("plan");
    const shown = api.getDiagram()!;
    expect(shown.activeVersion).toMatchObject({ key: "plan", status: null });
    expect(shown.components.find((c) => c.id === apiId)?.label).toBe("API v2");
    const base = api.getDiagram(diagramId, { base: true })!;
    expect(base.activeVersion).toBeNull();
    expect(base.components.find((c) => c.id === apiId)?.label).toBe("API");
    api.versions.setActive(null);
    expect(api.getDiagram()!.activeVersion).toBeNull();
  });

  it("reports conflicts when the base changes under a modified element", () => {
    api.versions.upsert({
      key: "plan",
      name: "Plan",
      diff: { modify: [{ id: apiId, name: "API v2" }] },
    });
    useDiagramStore.getState().updateComponent(apiId, { description: "changed in production" });
    expect(api.versions.list()[0]!.conflicts).toEqual([apiId]);
  });

  it("removes a Version by key", () => {
    api.versions.upsert({ key: "plan", name: "Plan", diff: {} });
    api.versions.remove("plan");
    expect(api.versions.list()).toEqual([]);
  });

  it("ignores a Version without a key or an unknown diagram", () => {
    expect(api.versions.upsert({ key: "", name: "x", diff: {} })).toBeNull();
    expect(
      api.versions.upsert({ key: "k", name: "x", diff: {} }, { diagramId: "nope" }),
    ).toBeNull();
  });

  it("delivers the user's actions on its Versions to the plugin, until it unsubscribes", () => {
    const seen: PluginVersionAction[] = [];
    const off = api.versions.onAction((action) => seen.push(action));
    expect(pluginHandlesVersionActions(manifest.id)).toBe(true);
    deliverVersionAction(manifest.id, { type: "merge", diagramId, key: "plan" });
    expect(seen).toEqual([{ type: "merge", diagramId, key: "plan" }]);
    off();
    expect(pluginHandlesVersionActions(manifest.id)).toBe(false);
  });
});
