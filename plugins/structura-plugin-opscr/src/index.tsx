/**
 * Structura opscr plugin — opscr architecture-as-code manifests in Structura.
 *
 * - Importer: one `*.opscr.yaml` file → a laid-out technical diagram.
 * - Document pane (API 1.4): bind the active diagram to a folder of manifests, edit them
 *   beside the canvas, and the diagram follows as you type.
 *
 * Build: npm link opscr && npm run build
 */
import type { StructuraPluginGlobal } from "./types/plugin.types";
import { canImportOpscr, importOpscr } from "./import-opscr";
import { createOpscrPane } from "./pane/OpscrPane";

declare global {
  interface Window {
    StructuraPlugin: StructuraPluginGlobal;
  }
}

window.StructuraPlugin.define({
  manifest: {
    id: "structura-plugin-opscr",
    name: "opscr",
    version: "0.3.0",
    author: "Structura",
    description: "Import opscr manifests, or edit a folder of them beside a diagram that follows",
    apiVersion: "^1.4",
    capabilities: [
      "io:importers",
      "ui:panels",
      "diagram:read",
      "diagram:write",
      "events:diagram",
      "storage",
      "files:folder",
    ],
  },
  activate(api) {
    api.registerImporter({
      id: "structura-plugin-opscr/manifests",
      label: { en: "opscr manifests", "pt-BR": "Manifestos opscr" },
      extensions: ["yaml", "yml"],
      canImport: canImportOpscr,
      import: importOpscr,
    });
    api.registerPanel({
      id: "structura-plugin-opscr/pane",
      slot: "document-pane",
      title: "opscr",
      component: createOpscrPane(api),
    });
  },
});
