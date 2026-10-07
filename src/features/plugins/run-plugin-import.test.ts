import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore, type Component } from "@/features/diagram";
import type { ImportResult, ImporterContribution } from "./plugin.types";
import { runPluginImport } from "./run-plugin-import";

/** An importer that returns `result` whatever the file says. */
const importerReturning = (result: Partial<ImportResult>): ImporterContribution => ({
  id: "test/importer",
  label: "Test",
  extensions: ["txt"],
  import: () => ({ components: [], connections: [], warnings: [], ...result }),
});

const at = { x: 10, y: 10 };

describe("runPluginImport — structured results (API 1.3)", () => {
  let diagramId: string;
  // Strictly increasing: the store's undo cooldown compares Date.now() across tests.
  let clockBase = Date.now();

  beforeEach(() => {
    clockBase += 100_000;
    vi.useFakeTimers({ now: clockBase });
    const store = useDiagramStore.getState();
    diagramId = store.addDiagram(`Import ${Math.random()}`, "container").id;
    store.openDiagram(diagramId);
    vi.advanceTimersByTime(2000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const components = (): Component[] =>
    Object.values(useDiagramStore.getState().diagrams[diagramId].snapshot.components);
  const named = (name: string) => components().find((c) => c.name === name)!;

  async function run(result: Partial<ImportResult>) {
    const outcome = await runPluginImport(importerReturning(result), "");
    if (!outcome.ok) throw new Error(`import failed: ${outcome.reason}`);
    return outcome;
  }

  it("keeps a catalog component with its service and technology", async () => {
    await run({
      components: [
        {
          key: "db",
          name: "orders-db",
          type: "aws-database",
          cloudServiceId: "dynamodb",
          technology: "DynamoDB",
          ...at,
        },
      ],
    });
    expect(named("orders-db")).toMatchObject({
      type: "aws-database",
      cloudServiceId: "dynamodb",
      technology: "DynamoDB",
    });
  });

  it("keeps C4 shapes, panels and plugin types, and degrades other built-ins to unknown", async () => {
    await run({
      components: [
        { key: "a", name: "c4", type: "container", technology: "Go", ...at },
        { key: "b", name: "panel", type: "panel", ...at },
        { key: "c", name: "plugin", type: "acme/widget", ...at },
        { key: "d", name: "endpoint", type: "endpoint", ...at },
        { key: "e", name: "untyped", ...at },
      ],
    });
    expect(named("c4")).toMatchObject({ type: "container", technology: "Go" });
    expect(named("panel").type).toBe("panel");
    expect(named("plugin").type).toBe("acme/widget");
    expect(named("endpoint").type).toBe("unknown");
    expect(named("untyped").type).toBe("unknown");
  });

  it("nests a component in a new panel of the same import", async () => {
    await run({
      components: [
        { key: "orders", name: "orders", type: "panel", ...at },
        { key: "api", name: "api", type: "container", parentKey: "orders", ...at },
      ],
    });
    expect(named("api").parentId).toBe(named("orders").id);
  });

  it("nests a component in an existing panel", async () => {
    const panel = useDiagramStore.getState().addComponent("panel", "Existing", null);
    await run({
      components: [{ key: "api", name: "api", type: "container", parentKey: panel.id, ...at }],
    });
    expect(named("api").parentId).toBe(panel.id);
  });

  it("cuts a parent cycle so no component is its own ancestor", async () => {
    await run({
      components: [
        { key: "a", name: "a", type: "panel", parentKey: "b", ...at },
        { key: "b", name: "b", type: "panel", parentKey: "a", ...at },
      ],
    });
    const byId = new Map(components().map((c) => [c.id, c]));
    for (const component of components()) {
      const seen = new Set([component.id]);
      for (let p = component.parentId; p; p = byId.get(p)?.parentId ?? null) {
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }
    }
    expect(components()).toHaveLength(2);
  });

  it("places a component with a missing parent at the top level", async () => {
    await run({
      components: [{ key: "a", name: "a", type: "container", parentKey: "nowhere", ...at }],
    });
    expect(named("a").parentId).toBeNull();
  });

  it("connects new and existing components, counts the unresolved, and undoes in one step", async () => {
    const existing = useDiagramStore.getState().addComponent("system", "Billing", null);
    vi.advanceTimersByTime(2000);

    const outcome = await run({
      components: [
        { key: "domain", name: "commerce", type: "panel", ...at },
        { key: "ctx", name: "orders", type: "panel", parentKey: "domain", ...at },
        {
          key: "api",
          name: "api",
          type: "aws-compute",
          cloudServiceId: "lambda",
          parentKey: "ctx",
          ...at,
        },
        { key: "db", name: "db", type: "aws-database", cloudServiceId: "dynamodb", ...at },
      ],
      connections: [
        { source: "api", target: "db", label: "writes" },
        { source: "api", target: existing.id, label: "calls" },
        { source: "api", target: "ghost" },
      ],
    });

    expect(outcome.importedComponentIds).toHaveLength(4);
    expect(outcome.skippedConnections).toBe(1);
    const connections = Object.values(
      useDiagramStore.getState().diagrams[diagramId].snapshot.connections,
    );
    expect(connections.map((c) => c.label).sort()).toEqual(["calls", "writes"]);

    useDiagramStore.getState().undo();
    expect(components().map((c) => c.name)).toEqual(["Billing"]);
    expect(
      Object.keys(useDiagramStore.getState().diagrams[diagramId].snapshot.connections),
    ).toEqual([]);
  });
});
