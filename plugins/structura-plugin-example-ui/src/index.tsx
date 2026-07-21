/**
 * Structura Example Plugin
 *
 * Demonstrates the new plugin system capabilities:
 * - canvas-toolbar slot (button in toolbar)
 * - ui:overlays capability (toasts and modals)
 * - diagram:read capability (read diagram name)
 * - react dependency via api.dependencies.react
 *
 * Build: npm run build
 * Or: npx vite build
 */

// Types
import type { PluginManifest, StructuraPluginApi } from "./types/plugin";

// Hooks
import { initializePlugin } from "./hooks/usePluginApi";

// Components
import { ToolbarButton, SettingsPanel } from "./components";

/**
 * Plugin manifest - declares capabilities and dependencies
 */
const manifest: PluginManifest = {
  id: "structura-plugin-example-ui",
  name: "Example UI Plugin",
  version: "1.0.0",
  author: "Structura Team",
  description: "Demonstrates toolbar button, toasts, and modal dialogs",
  apiVersion: "^1.1",
  capabilities: [
    "ui:panels",
    "ui:overlays",
    "diagram:read",
    "events:diagram", // Required for onDiagramChange
  ],
  uses: ["react"], // Request React from host
};

/**
 * Global declaration for window.StructuraPlugin
 */
declare global {
  interface Window {
    StructuraPlugin: {
      define(definition: {
        manifest: PluginManifest;
        activate: (api: StructuraPluginApi) => void;
      }): void;
    };
  }
}

/**
 * Plugin activation function
 */
function activate(api: StructuraPluginApi): void {
  // Initialize plugin API and React
  initializePlugin(api);

  console.log("[Example Plugin] Activated with React!");

  // Register toolbar button
  api.registerPanel({
    id: "example-toolbar-button",
    slot: "canvas-toolbar",
    title: { en: "Example", "pt-BR": "Exemplo" },
    component: ToolbarButton,
  });

  // Register settings panel (shown when element is selected)
  api.registerPanel({
    id: "example-settings",
    slot: "element-inspector",
    title: { en: "Example Settings", "pt-BR": "Configurações de Exemplo" },
    component: SettingsPanel,
  });

  // Register event listener to demonstrate diagram:read
  api.onDiagramChange((diagramId: string) => {
    const diagram = api.getDiagram(diagramId);
    if (diagram) {
      console.log(`[Example Plugin] Diagram changed: ${diagram.name}`);
    }
  });
}

/**
 * Define the plugin
 */
window.StructuraPlugin.define({
  manifest,
  activate,
});
