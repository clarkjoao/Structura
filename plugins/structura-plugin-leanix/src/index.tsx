/**
 * Structura Leanix Integration Plugin
 *
 * Export diagrams to Leanix ITSM:
 * - canvas-toolbar slot (floating panel with export button)
 * - events:diagram (detect diagram changes for dirty tracking)
 * - diagram:read capability (read diagram name)
 * - network capability (API calls)
 * - storage capability (persist config and panel position)
 * - ui:overlays capability (toasts and modals)
 * - ui:panels capability (register toolbar panel)
 *
 * Build: npm run build
 */

import type { StructuraPluginGlobal } from "./types/plugin.types";
import { initializePlugin } from "./hooks/usePluginApi";
import { LeanixToolbarButton } from "./components";
import { LeanixConfigProvider } from "./hooks/useLeanixConfig";

declare global {
  interface Window {
    StructuraPlugin: StructuraPluginGlobal;
  }
}

/**
 * Plugin manifest — declares capabilities and API version.
 * React is shared by the host as a build-time external; no `uses: ["react"]` needed.
 */
window.StructuraPlugin.define({
  manifest: {
    id: "structura-plugin-leanix",
    name: "Leanix Integration",
    version: "1.0.0",
    author: "Structura",
    description: "Export diagrams to Leanix ITSM",
    apiVersion: "^1.2",
    capabilities: [
      "events:diagram",
      "network",
      "ui:panels",
      "ui:overlays",
      "diagram:read",
      "storage",
    ],
  },

  activate(api) {
    console.log("[Leanix Plugin] Activating...");
    initializePlugin(api);

    api.registerPanel({
      id: "leanix-toolbar",
      slot: "canvas-toolbar",
      title: { en: "Leanix", "pt-BR": "Leanix" },
      component: (props) => (
        <LeanixConfigProvider>
          <LeanixToolbarButton {...props} />
        </LeanixConfigProvider>
      ),
    });

    console.log("[Leanix Plugin] Panel registered!");
  },
});
