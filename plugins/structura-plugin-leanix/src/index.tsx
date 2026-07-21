/**
 * Structura Leanix Integration Plugin
 *
 * Export diagrams to Leanix ITSM:
 * - canvas-toolbar slot (button in toolbar)
 * - ui:overlays capability (toasts and modals)
 * - diagram:read capability (read diagram name)
 * - network capability (API calls)
 *
 * Build: npm run build
 */

// Types
import type { PluginManifest, StructuraPluginApi } from "./types/plugin";

// Hooks
import { initializePlugin } from "./hooks/usePluginApi";

// Components
import { LeanixToolbarButton } from "./components";

/**
 * Plugin manifest - declares capabilities and dependencies
 */
const manifest: PluginManifest = {
  id: "structura-plugin-leanix",
  name: "Leanix Integration",
  version: "1.0.0",
  author: "Structura",
  description: "Export diagrams to Leanix ITSM",
  apiVersion: "^1.1",
  capabilities: [
    "network",
    "ui:panels",
    "ui:overlays",
    "diagram:read",
  ],
  uses: ["react"],
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
  console.log("[Leanix Plugin] Activating...");
  console.log("[Leanix Plugin] API:", Object.keys(api));

  // Initialize plugin API and React
  initializePlugin(api);

  console.log("[Leanix Plugin] Plugin initialized");

  // Register toolbar button
  api.registerPanel({
    id: "leanix-toolbar",
    slot: "canvas-toolbar",
    title: { en: "Leanix", "pt-BR": "Leanix" },
    component: LeanixToolbarButton,
  });

  console.log("[Leanix Plugin] Panel registered!");
}

/**
 * Define the plugin
 */
window.StructuraPlugin.define({
  manifest,
  activate,
});
