/**
 * Structura opscr plugin — opscr architecture-as-code manifests in Structura.
 *
 * - Importer: one `*.opscr.yaml` file → a laid-out technical diagram.
 * - Document pane (API 1.4): bind the active diagram to a folder of manifests, edit them
 *   beside the canvas, and the diagram follows as you type.
 * - Workspace importer (API 1.14): set a whole folder up from the workspace home.
 *
 * Build: npm link opscr && npm run build
 */
import type { StructuraPluginGlobal } from "./types/plugin.types";
import { canImportOpscr, importOpscr } from "./import-opscr";
import { createOpscrPane } from "./pane/OpscrPane";
import { createChatContext } from "./chat-context";
import { createWorkspaceImport, PANE_ID } from "./workspace-import";

declare global {
  interface Window {
    StructuraPlugin: StructuraPluginGlobal;
  }
}

window.StructuraPlugin.define({
  manifest: {
    id: "structura-plugin-opscr",
    name: "opscr",
    version: "0.16.0",
    author: "Structura",
    description: "Import opscr manifests, or edit a folder of them beside a diagram that follows",
    apiVersion: "^1.14",
    capabilities: [
      "io:importers",
      "ui:panels",
      "diagram:read",
      "diagram:write",
      "events:diagram",
      "storage",
      "files:folder",
      "llm:context",
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
      id: PANE_ID,
      slot: "document-pane",
      title: "opscr",
      component: createOpscrPane(api),
    });
    // On the workspace home: a whole opscr folder set up in one pick.
    api.registerWorkspaceImporter(createWorkspaceImport(api));
    // On a bound diagram whose folder is open, the chat edits its YAML with the opscr skill.
    api.registerChatContext(createChatContext());
  },
});
