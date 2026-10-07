/**
 * Structura opscr plugin — imports opscr architecture-as-code manifests.
 *
 * One `*.opscr.yaml` file in, a laid-out technical diagram out: Domains and bounded
 * contexts as panels, technical Kinds as their cloud catalog components, flow edges as
 * connections. See README.md.
 *
 * Build: npm link opscr && npm run build
 */
import type { StructuraPluginGlobal } from "./types/plugin.types";
import { canImportOpscr, importOpscr } from "./import-opscr";

declare global {
  interface Window {
    StructuraPlugin: StructuraPluginGlobal;
  }
}

window.StructuraPlugin.define({
  manifest: {
    id: "structura-plugin-opscr",
    name: "opscr Import",
    version: "0.1.0",
    author: "Structura",
    description: "Import opscr architecture-as-code manifests as a laid-out diagram",
    apiVersion: "^1.3",
    capabilities: ["io:importers"],
  },
  activate(api) {
    api.registerImporter({
      id: "structura-plugin-opscr/manifests",
      label: { en: "opscr manifests", "pt-BR": "Manifestos opscr" },
      extensions: ["yaml", "yml"],
      canImport: canImportOpscr,
      import: importOpscr,
    });
  },
});
