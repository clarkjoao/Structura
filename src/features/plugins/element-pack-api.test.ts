import { afterEach, describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { getElement, hasElement } from "@/features/elements/element.registry";
import { registryCatalogEntries } from "@/features/elements/search";
import { getDescriptor } from "@/features/canvas/nodes/node-types/registry";
import type { PluginElementPack, PluginManifest, PluginShape } from "./plugin.types";
import {
  createContributionTracker,
  createScopedPluginApi,
  rollbackContributions,
  type PluginContributionTracker,
} from "./plugin-api";

const manifest: PluginManifest = {
  id: "acme-cloud",
  name: "Acme Cloud",
  version: "1.0.0",
  author: "Tests",
  description: "Tests the v1.17 element pack API",
  apiVersion: "^1.17",
  capabilities: ["canvas:elements"],
};

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

const pack: PluginElementPack = {
  id: "acme-cloud",
  label: { en: "Acme Cloud", "pt-BR": "Acme Cloud" },
  categories: [
    {
      id: "compute",
      label: { en: "Compute", "pt-BR": "Computação" },
      description: { en: "Acme compute.", "pt-BR": "Computação da Acme." },
      accent: { light: "#3366ff" },
    },
  ],
  services: [{ id: "vm", name: "VM", category: "compute", icon: "vm" }],
  icons: { vm: ICON },
};

const shape: PluginShape = {
  id: "cylinder-3d",
  label: { en: "3D cylinder", "pt-BR": "Cilindro 3D" },
  viewBox: "0 0 100 100",
  paths: ["M10 20 C10 0 90 0 90 20 V80 C90 100 10 100 10 80 Z"],
};

let tracker: PluginContributionTracker;
const api = () => {
  tracker = createContributionTracker();
  return createScopedPluginApi(manifest, tracker, new InMemoryAdapter());
};

afterEach(() => rollbackContributions(tracker));

describe("v1.17 element pack API", () => {
  it("adds a family whose services the catalog offers under the plugin's group", () => {
    api().registerElementPack(pack);
    expect(hasElement("acme-cloud/compute")).toBe(true);
    const { groups, entries } = registryCatalogEntries();
    expect(groups.find((group) => group.id === "acme-cloud")?.label).toBe("Acme Cloud");
    expect(entries.some((entry) => entry.groupId === "acme-cloud" && entry.label === "VM")).toBe(
      true,
    );
    const vm = getElement("acme-cloud/compute")!.model.createComponent(
      { id: "c1", name: "VM", description: "", parentId: null },
      { serviceId: "vm" },
    );
    expect(vm.type).toBe("acme-cloud/compute");
  });

  it("refuses a pack whose id is not the plugin id, registering nothing", () => {
    expect(() => api().registerElementPack({ ...pack, id: "aws" })).toThrow(/plugin id/);
    expect(hasElement("aws/compute")).toBe(false);
  });

  it("refuses an icon that is not SVG", () => {
    expect(() => api().registerElementPack({ ...pack, icons: { vm: "<div>no</div>" } })).toThrow(
      /not a valid SVG/,
    );
    expect(hasElement("acme-cloud/compute")).toBe(false);
  });

  it("adds shapes to the pack's group, or to one named after the plugin", () => {
    const scoped = api();
    scoped.registerShape(shape);
    expect(getElement("acme-cloud/cylinder-3d")?.canvas.role).toBe("custom-shape");
    expect(registryCatalogEntries().groups.find((g) => g.id === "acme-cloud")?.label).toBe(
      "Acme Cloud",
    );
    // A pack registered after the shape keeps it.
    scoped.registerElementPack(pack);
    expect(hasElement("acme-cloud/cylinder-3d")).toBe(true);
    expect(hasElement("acme-cloud/compute")).toBe(true);
    expect(() => scoped.registerShape(shape)).toThrow(/already registered/);
  });

  it("removes everything on deactivate; saved components degrade to unknown and come back", () => {
    api().registerElementPack(pack);
    expect(getDescriptor("acme-cloud/compute").rfType).toBe("acme-cloud/compute");

    rollbackContributions(tracker);
    expect(hasElement("acme-cloud/compute")).toBe(false);
    expect(registryCatalogEntries().groups.some((group) => group.id === "acme-cloud")).toBe(false);
    expect(getDescriptor("acme-cloud/compute").rfType).toBe(getDescriptor("unknown").rfType);

    api().registerElementPack(pack);
    expect(getDescriptor("acme-cloud/compute").rfType).toBe("acme-cloud/compute");
  });
});
