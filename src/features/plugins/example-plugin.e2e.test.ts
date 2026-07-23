import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { useDiagramStore } from "@/features/diagram";
import {
  initializePluginRegistry,
  installPluginFromCode,
  resetPluginRegistryForTests,
  setPluginEnabled,
  uninstallPlugin,
} from "./plugin-registry";
import { findImportersForFile, getIoRegistrySnapshot } from "./io-registry";
import { runPluginImport } from "./run-plugin-import";

/**
 * End-to-end pass over the shipped example plugin: install the real file, import a real
 * Mermaid flowchart through the real store, verify dedupe, undo, and lifecycle cleanup.
 */

const EXAMPLE_PLUGIN_PATH = join(
  __dirname,
  "../../../plugins/examples/mermaid-import/plugin.js",
);
const PLUGIN_ID = "structura-plugin-mermaid-import";
const IMPORTER_ID = `${PLUGIN_ID}/flowchart`;

const MERMAID_TEXT = `flowchart TD
  api[API Gateway] -->|routes| billing[Billing]
  api --> auth[Auth Service]
  %% a comment
  billing --> db[(Billing DB)]
  this line is not mermaid
`;

describe("example plugin end-to-end", () => {
  beforeEach(async () => {
    await initializePluginRegistry(new InMemoryAdapter());
  });

  afterEach(async () => {
    await resetPluginRegistryForTests();
  });

  it("installs from the real file and round-trips an import with undo", async () => {
    const code = readFileSync(EXAMPLE_PLUGIN_PATH, "utf-8");
    const install = await installPluginFromCode(code);
    expect(install).toMatchObject({ ok: true, manifest: { id: PLUGIN_ID } });

    // The importer is offered for .mmd files with flowchart content only.
    expect(findImportersForFile("diagram.mmd", MERMAID_TEXT)).toHaveLength(1);
    expect(findImportersForFile("diagram.mmd", "sequenceDiagram")).toHaveLength(0);

    const store = useDiagramStore;
    const diagram = store.getState().addDiagram("Plugin E2E", "context");
    store.getState().openDiagram(diagram.id);
    // Pre-existing component with a matching name: the plugin must reuse it (dedupe).
    const existingComponent = store.getState().addComponent("system", "Billing", null);

    const importer = findImportersForFile("diagram.mmd", MERMAID_TEXT)[0];
    const outcome = await runPluginImport(importer, MERMAID_TEXT);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // api, auth, db are new; billing was deduped onto the existing component.
    expect(outcome.importedComponentIds).toHaveLength(3);
    expect(outcome.skippedConnections).toBe(0);
    expect(outcome.warnings.some((w) => w.includes("Billing"))).toBe(true);
    expect(outcome.warnings.some((w) => w.includes("not mermaid"))).toBe(true);

    const active = store.getState().diagrams[diagram.id];
    const componentNames = Object.values(active.snapshot.components).map((c) => c.name);
    expect(componentNames).toEqual(
      expect.arrayContaining(["API Gateway", "Auth Service", "Billing DB", "Billing"]),
    );
    const connections = Object.values(active.snapshot.connections);
    expect(connections).toHaveLength(3);
    expect(
      connections.some((c) => c.targetId === existingComponent.id && c.label === "routes"),
    ).toBe(true);

    // A single undo reverts the whole import (spec scenario).
    store.getState().undo();
    const afterUndo = store.getState().diagrams[diagram.id];
    expect(Object.keys(afterUndo.snapshot.components)).toEqual([existingComponent.id]);
    expect(Object.keys(afterUndo.snapshot.connections)).toHaveLength(0);

    // Disable drops the importer; uninstall keeps it dropped (spec scenarios).
    await setPluginEnabled(PLUGIN_ID, false);
    expect(getIoRegistrySnapshot().importers.find((i) => i.id === IMPORTER_ID)).toBeUndefined();
    await setPluginEnabled(PLUGIN_ID, true);
    expect(getIoRegistrySnapshot().importers.find((i) => i.id === IMPORTER_ID)).toBeDefined();
    await uninstallPlugin(PLUGIN_ID);
    expect(getIoRegistrySnapshot().importers.find((i) => i.id === IMPORTER_ID)).toBeUndefined();
  });
});
