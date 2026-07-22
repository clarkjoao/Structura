/**
 * Structura Example UI Plugin
 *
 * Demonstrates the plugin system with ordinary React:
 * - canvas-toolbar slot (button that opens a draggable panel)
 * - element-inspector slot (settings panel on selection)
 * - ui:overlays (toasts + modal)
 * - diagram:read (active diagram name/counts)
 * - storage (persisted panel position via api.storage)
 *
 * React comes from the host as a build-time external (see vite.config.js), so this plugin
 * writes normal React — `import { useState } from "react"`, JSX with the automatic runtime —
 * with no getReact() / factory-function workarounds.
 *
 * Build: npm run build  →  upload dist/plugin.js from the Plugins page.
 */
import type {
  PluginManifest,
  StructuraPluginApi,
  StructuraPluginGlobal,
} from "./types/plugin.types";
import { initializePlugin } from "./hooks/usePluginApi";
import { ToolbarButton, SettingsPanel } from "./components";

declare global {
  interface Window {
    StructuraPlugin: StructuraPluginGlobal;
  }
}

const manifest: PluginManifest = {
  id: "structura-plugin-example-ui",
  name: "Example UI Plugin",
  version: "1.1.0",
  author: "Structura Team",
  description: "Demonstrates toolbar button, toasts, and modal dialogs",
  apiVersion: "^1.2",
  capabilities: ["ui:panels", "ui:overlays", "diagram:read", "events:diagram", "storage"],
};

function activate(api: StructuraPluginApi): void {
  initializePlugin(api);

  api.registerPanel({
    id: "example-toolbar-button",
    slot: "canvas-toolbar",
    title: { en: "Example", "pt-BR": "Exemplo" },
    component: ToolbarButton,
  });

  api.registerPanel({
    id: "example-settings",
    slot: "element-inspector",
    title: { en: "Example Settings", "pt-BR": "Configurações de Exemplo" },
    component: SettingsPanel,
  });

  api.onDiagramChange((diagramId) => {
    const diagram = api.getDiagram(diagramId);
    if (diagram) {
      console.log(`[Example Plugin] Diagram changed: ${diagram.name}`);
    }
  });
}

window.StructuraPlugin.define({ manifest, activate });
