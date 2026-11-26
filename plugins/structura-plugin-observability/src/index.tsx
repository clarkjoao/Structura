/**
 * Structura Observability Plugin — a test plugin for API 1.17 + 1.18.
 *
 * - `registerElementPack` (1.17): an "Observability" family — Metrics, Logs, Tracing — with
 *   Prometheus, Grafana, Loki, Jaeger and the OpenTelemetry Collector, offered in the element
 *   catalog, search and the assistant like the built-in AWS services.
 * - `registerShape` (1.17): an "Alert rule" shape.
 * - `@structura/ui` (1.18): an inspector panel built only from host components that stores
 *   retention, alerting and on-call as tags on the selected element.
 *
 * Build: npm run build  →  upload dist/plugin.js from the Plugins page.
 */
import type {
  PluginManifest,
  StructuraPluginApi,
  StructuraPluginGlobal,
} from "./types/plugin.types";
import { ALERT_SHAPE, OBSERVABILITY_PACK, PLUGIN_ID } from "./pack";
import { createObservabilityPanel } from "./ObservabilityPanel";

declare global {
  interface Window {
    StructuraPlugin: StructuraPluginGlobal;
  }
}

const manifest: PluginManifest = {
  id: PLUGIN_ID,
  name: "Observability",
  version: "1.0.0",
  author: "Structura examples",
  description:
    "Adds an observability element family (Prometheus, Grafana, Loki, Jaeger, OpenTelemetry) and an inspector panel built with the host UI kit.",
  apiVersion: "^1.18",
  capabilities: ["canvas:elements", "ui:panels", "ui:overlays", "diagram:write"],
};

function activate(api: StructuraPluginApi): void {
  api.registerElementPack(OBSERVABILITY_PACK);
  api.registerShape(ALERT_SHAPE);
  api.registerPanel({
    id: `${PLUGIN_ID}/inspector`,
    slot: "element-inspector",
    title: { en: "Observability", "pt-BR": "Observabilidade" },
    component: createObservabilityPanel(api),
  });
}

window.StructuraPlugin.define({ manifest, activate });
