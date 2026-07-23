import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { NODE_TYPE_REGISTRY } from "@/features/canvas/nodes/node-types/registry";
import {
  PLUGIN_BUNDLED_DISABLED_KEY,
  PLUGIN_INSTALL_RECORDS_KEY,
  getInstalledPluginIds,
  getPluginRegistrySnapshot,
  initializePluginRegistry,
  installPluginFromCode,
  resetPluginRegistryForTests,
  setBundledPluginEnabled,
  setPluginEnabled,
  uninstallPlugin,
} from "./plugin-registry";
import { getImporterContribution } from "./io-registry";
import type { PluginInstallRecord } from "./plugin.types";

// The bundled ("built-in") layer is fed from a build-only virtual module; mock its accessor so
// tests can inject fixtures. Default is empty, so the suites above see no built-in plugins.
const bundledFixture = vi.hoisted(() => ({ list: [] as { dir: string; code: string }[] }));
vi.mock("./bundled-plugins", () => ({
  getBundledPlugins: () => bundledFixture.list,
}));

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

const BUNDLED_ID = "structura-plugin-bundled";

function bundledCode(id: string, importerId: string): string {
  return `
    window.StructuraPlugin.define({
      manifest: {
        id: "${id}",
        name: "Bundled Plugin",
        version: "1.0.0",
        author: "Tests",
        description: "A bundled plugin",
        apiVersion: "^1.0",
        capabilities: ["io:importers"],
      },
      activate: (api) => {
        api.registerImporter({
          id: "${importerId}",
          label: "Bundled",
          extensions: ["bnd"],
          import: () => ({ components: [], connections: [], warnings: [] }),
        });
      },
    });
  `;
}

/** Set the built-in fixture and boot the registry against it from a clean slate. */
async function bootWithBundled(list: { dir: string; code: string }[]): Promise<void> {
  bundledFixture.list = list;
  await resetPluginRegistryForTests();
  await initializePluginRegistry(port);
}

describe("bundled (built-in) plugins", () => {
  afterEach(() => {
    bundledFixture.list = [];
  });

  it("activates a bundled plugin at boot without persisting it as an install record", async () => {
    await bootWithBundled([{ dir: "bundled", code: bundledCode(BUNDLED_ID, "bundled-importer") }]);

    expect(getImporterContribution("bundled-importer")).toBeDefined();
    const snapshot = getPluginRegistrySnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({ source: "bundled", active: true, enabled: true });
    // Built-in plugins never touch the user install records.
    expect(await port.load(PLUGIN_INSTALL_RECORDS_KEY)).toBeNull();
    expect(getInstalledPluginIds()).toContain(BUNDLED_ID);
  });

  it("persists the disable choice and re-activates on re-enable across a restart", async () => {
    await bootWithBundled([{ dir: "bundled", code: bundledCode(BUNDLED_ID, "bundled-importer") }]);

    await setBundledPluginEnabled(BUNDLED_ID, false);
    expect(getImporterContribution("bundled-importer")).toBeUndefined();
    expect(await port.load(PLUGIN_BUNDLED_DISABLED_KEY)).toEqual([BUNDLED_ID]);

    // Restart: the disabled choice sticks.
    await resetPluginRegistryForTests();
    await initializePluginRegistry(port);
    expect(getImporterContribution("bundled-importer")).toBeUndefined();
    expect(getPluginRegistrySnapshot()[0]).toMatchObject({ enabled: false, active: false });

    await setBundledPluginEnabled(BUNDLED_ID, true);
    expect(getImporterContribution("bundled-importer")).toBeDefined();
    expect(await port.load(PLUGIN_BUNDLED_DISABLED_KEY)).toEqual([]);
  });

  it("shadows a user record that collides with a bundled id (bundled wins)", async () => {
    // Pre-seed a user install record sharing the bundled id but a different contribution.
    const userRecord: PluginInstallRecord = {
      manifest: {
        id: BUNDLED_ID,
        name: "Impostor",
        version: "9.9.9",
        author: "User",
        description: "Colliding user plugin",
        apiVersion: "^1.0",
        capabilities: ["io:importers"],
      },
      code: bundledCode(BUNDLED_ID, "user-importer"),
      enabled: true,
      errored: false,
      installedAt: 123,
    };
    await port.save(PLUGIN_INSTALL_RECORDS_KEY, [userRecord]);

    await bootWithBundled([{ dir: "bundled", code: bundledCode(BUNDLED_ID, "bundled-importer") }]);

    expect(getImporterContribution("bundled-importer")).toBeDefined();
    expect(getImporterContribution("user-importer")).toBeUndefined();
    const snapshot = getPluginRegistrySnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({ source: "bundled" });
  });

  it("ignores uninstall for a bundled plugin", async () => {
    await bootWithBundled([{ dir: "bundled", code: bundledCode(BUNDLED_ID, "bundled-importer") }]);

    await uninstallPlugin(BUNDLED_ID);
    expect(getImporterContribution("bundled-importer")).toBeDefined();
    expect(getPluginRegistrySnapshot()).toHaveLength(1);
  });
});
