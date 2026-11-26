import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { hasElement } from "@/features/elements/element.registry";
import { registryCatalogEntries } from "@/features/elements/search";
import {
  initializePluginRegistry,
  installPluginFromCode,
  resetPluginRegistryForTests,
  setPluginEnabled,
  uninstallPlugin,
} from "./plugin-registry";

/** The shipped element-pack example, installed from its real file through the real registry. */

const PLUGIN_PATH = join(__dirname, "../../../plugins/examples/element-pack/plugin.js");
const PLUGIN_ID = "structura-plugin-element-pack";
const offered = () =>
  registryCatalogEntries()
    .entries.filter((entry) => entry.groupId === PLUGIN_ID)
    .map((entry) => entry.label);

describe("element-pack example plugin end-to-end", () => {
  beforeEach(async () => {
    await initializePluginRegistry(new InMemoryAdapter());
  });

  afterEach(async () => {
    await resetPluginRegistryForTests();
  });

  it("offers its services and shape while enabled, and nothing once disabled or removed", async () => {
    const install = await installPluginFromCode(readFileSync(PLUGIN_PATH, "utf-8"));
    expect(install).toMatchObject({ ok: true, manifest: { id: PLUGIN_ID } });

    expect(hasElement(`${PLUGIN_ID}/network`)).toBe(true);
    expect(hasElement(`${PLUGIN_ID}/hexagon-tile`)).toBe(true);
    expect(offered()).toEqual(expect.arrayContaining(["Edge Router", "Edge Cache"]));

    await setPluginEnabled(PLUGIN_ID, false);
    expect(hasElement(`${PLUGIN_ID}/network`)).toBe(false);
    expect(offered()).toEqual([]);

    await setPluginEnabled(PLUGIN_ID, true);
    expect(hasElement(`${PLUGIN_ID}/hexagon-tile`)).toBe(true);

    await uninstallPlugin(PLUGIN_ID);
    expect(hasElement(`${PLUGIN_ID}/network`)).toBe(false);
  });
});
