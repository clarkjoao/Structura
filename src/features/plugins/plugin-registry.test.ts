import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { NODE_TYPE_REGISTRY } from "@/features/canvas/nodes/node-types/registry";
import {
  PLUGIN_INSTALL_RECORDS_KEY,
  getPluginRegistrySnapshot,
  initializePluginRegistry,
  installPluginFromCode,
  resetPluginRegistryForTests,
  setPluginEnabled,
  uninstallPlugin,
} from "./plugin-registry";
import { getImporterContribution } from "./io-registry";
import type { PluginInstallRecord } from "./plugin.types";

const PLUGIN_ID = "structura-plugin-test";

function pluginCode(body: string): string {
  return `
    window.StructuraPlugin.define({
      manifest: {
        id: "${PLUGIN_ID}",
        name: "Test Plugin",
        version: "1.0.0",
        author: "Tests",
        description: "A test plugin",
        apiVersion: "^1.0",
        capabilities: ["io:importers", "canvas:node-types", "storage"],
      },
      activate: (api) => { ${body} },
    });
  `;
}

const REGISTER_IMPORTER = `
  api.registerImporter({
    id: "test-importer",
    label: "Test",
    extensions: ["tst"],
    import: () => ({ components: [], connections: [], warnings: [] }),
  });
`;

let port: InMemoryAdapter;

beforeEach(async () => {
  port = new InMemoryAdapter();
  await initializePluginRegistry(port);
});

afterEach(async () => {
  await resetPluginRegistryForTests();
});

describe("installPluginFromCode", () => {
  it("installs, activates and persists a valid plugin", async () => {
    const result = await installPluginFromCode(pluginCode(REGISTER_IMPORTER));
    expect(result.ok).toBe(true);
    expect(getImporterContribution("test-importer")).toBeDefined();

    const stored = await port.load<PluginInstallRecord[]>(PLUGIN_INSTALL_RECORDS_KEY);
    expect(stored).toHaveLength(1);
    expect(stored?.[0].manifest.id).toBe(PLUGIN_ID);
    expect(stored?.[0].enabled).toBe(true);

    const snapshot = getPluginRegistrySnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].active).toBe(true);
  });

  it("rejects a file that never calls define, persisting nothing (spec scenario)", async () => {
    const result = await installPluginFromCode("const x = 1;");
    expect(result).toEqual({ ok: false, reason: "load-error", code: "no-define" });
    expect(await port.load(PLUGIN_INSTALL_RECORDS_KEY)).toBeNull();
    expect(getPluginRegistrySnapshot()).toHaveLength(0);
  });

  it("rejects duplicate define calls and top-level throws", async () => {
    const twice = pluginCode("") + pluginCode("");
    expect(await installPluginFromCode(twice)).toEqual({
      ok: false,
      reason: "load-error",
      code: "multiple-define",
    });
    expect(await installPluginFromCode("throw new Error('boom');")).toEqual({
      ok: false,
      reason: "load-error",
      code: "execution-error",
    });
  });

  it("rejects an invalid manifest without executing activate", async () => {
    const code = `
      window.StructuraPlugin.define({
        manifest: { id: "x", capabilities: [] },
        activate: () => { throw new Error("activate must not run"); },
      });
    `;
    const result = await installPluginFromCode(code);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "invalid-manifest") {
      expect(result.errors.length).toBeGreaterThan(0);
    } else {
      throw new Error("expected invalid-manifest");
    }
  });

  it("rejects a duplicate plugin id (spec scenario)", async () => {
    await installPluginFromCode(pluginCode(""));
    const result = await installPluginFromCode(pluginCode(""));
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "invalid-manifest") {
      expect(result.errors).toContainEqual({
        code: "duplicate-id",
        field: "id",
        detail: PLUGIN_ID,
      });
    } else {
      throw new Error("expected invalid-manifest");
    }
  });

  it("rolls back tracked contributions when activate throws (spec scenario)", async () => {
    const sizeBefore = NODE_TYPE_REGISTRY.length;
    const code = pluginCode(`
      api.registerNodeType({
        rfType: "${PLUGIN_ID}/hexagon",
        componentType: "${PLUGIN_ID}/hexagon",
        component: () => null,
        buildData: () => ({}),
      });
      ${REGISTER_IMPORTER}
      throw new Error("activation failed");
    `);
    const result = await installPluginFromCode(code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("activation-error");
    expect(NODE_TYPE_REGISTRY.length).toBe(sizeBefore);
    expect(getImporterContribution("test-importer")).toBeUndefined();
    expect(await port.load(PLUGIN_INSTALL_RECORDS_KEY)).toBeNull();
  });

  it("rejects non-namespaced rfType registrations (spec scenario)", async () => {
    const sizeBefore = NODE_TYPE_REGISTRY.length;
    const code = pluginCode(`
      api.registerNodeType({
        rfType: "panel",
        componentType: "panel",
        component: () => null,
        buildData: () => ({}),
      });
    `);
    const result = await installPluginFromCode(code);
    expect(result.ok).toBe(false);
    expect(NODE_TYPE_REGISTRY.length).toBe(sizeBefore);
  });
});

describe("lifecycle", () => {
  it("disable removes all contributions; re-enable restores them (spec scenario)", async () => {
    await installPluginFromCode(pluginCode(REGISTER_IMPORTER));
    expect(getImporterContribution("test-importer")).toBeDefined();

    await setPluginEnabled(PLUGIN_ID, false);
    expect(getImporterContribution("test-importer")).toBeUndefined();
    expect(getPluginRegistrySnapshot()[0]).toMatchObject({ enabled: false, active: false });

    await setPluginEnabled(PLUGIN_ID, true);
    expect(getImporterContribution("test-importer")).toBeDefined();
    expect(getPluginRegistrySnapshot()[0]).toMatchObject({ enabled: true, active: true });
  });

  it("uninstall deletes the record and the storage namespace (spec scenario)", async () => {
    await installPluginFromCode(
      pluginCode(`${REGISTER_IMPORTER} void api.storage.set("config", { a: 1 });`),
    );
    // Let the fire-and-forget storage write settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await port.load(`plugin:${PLUGIN_ID}:config`)).toEqual({ a: 1 });

    await uninstallPlugin(PLUGIN_ID);
    expect(getImporterContribution("test-importer")).toBeUndefined();
    expect(await port.load<PluginInstallRecord[]>(PLUGIN_INSTALL_RECORDS_KEY)).toEqual([]);
    expect(await port.load(`plugin:${PLUGIN_ID}:config`)).toBeNull();
    expect(getPluginRegistrySnapshot()).toHaveLength(0);
  });

  it("startup re-activates enabled plugins but never disabled ones (spec scenario)", async () => {
    await installPluginFromCode(pluginCode(REGISTER_IMPORTER));
    await setPluginEnabled(PLUGIN_ID, false);
    await resetPluginRegistryForTests();

    // Simulated app restart with the same storage port.
    await initializePluginRegistry(port);
    expect(getImporterContribution("test-importer")).toBeUndefined();
    expect(getPluginRegistrySnapshot()[0]).toMatchObject({ enabled: false, active: false });

    await setPluginEnabled(PLUGIN_ID, true);
    await resetPluginRegistryForTests();
    await initializePluginRegistry(port);
    expect(getImporterContribution("test-importer")).toBeDefined();
    expect(getPluginRegistrySnapshot()[0]).toMatchObject({ enabled: true, active: true });
  });

  it("marks a plugin errored when startup activation fails, keeping the app running", async () => {
    await installPluginFromCode(pluginCode(REGISTER_IMPORTER));
    // Corrupt the stored code to force a startup failure.
    const stored = await port.load<PluginInstallRecord[]>(PLUGIN_INSTALL_RECORDS_KEY);
    stored![0].code = "throw new Error('corrupted');";
    await port.save(PLUGIN_INSTALL_RECORDS_KEY, stored);
    await resetPluginRegistryForTests();

    await initializePluginRegistry(port);
    expect(getPluginRegistrySnapshot()[0]).toMatchObject({ errored: true, active: false });
    expect(getImporterContribution("test-importer")).toBeUndefined();
  });
});
