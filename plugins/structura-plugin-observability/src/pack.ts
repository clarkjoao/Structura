import type { PluginElementPack, PluginShape } from "./types/plugin.types";

export const PLUGIN_ID = "structura-plugin-observability";

/** Original line icons (not vendor logos): the service name says which product it is. */
const icon = (color: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS: Record<string, string> = {
  metrics: icon("#e6522c", '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
  dashboard: icon(
    "#f46800",
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  ),
  logs: icon("#2f7d4f", '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h13"/>'),
  traces: icon(
    "#6d4aff",
    '<path d="M3 6h8"/><path d="M7 12h10"/><path d="M11 18h10"/><circle cx="3" cy="6" r="1"/>',
  ),
  collector: icon(
    "#425cc7",
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  ),
};

/** The observability family: three categories, five services. Types become `<pluginId>/<id>`. */
export const OBSERVABILITY_PACK: PluginElementPack = {
  id: PLUGIN_ID,
  label: { en: "Observability", "pt-BR": "Observabilidade" },
  primaryCategories: ["metrics", "logs", "tracing"],
  spotlightServices: ["prometheus", "grafana"],
  categories: [
    {
      id: "metrics",
      label: { en: "Metrics", "pt-BR": "Métricas" },
      description: {
        en: "Metric stores and dashboards.",
        "pt-BR": "Bases de métricas e painéis.",
      },
      accent: { light: "#e6522c", dark: "#ff7a50" },
    },
    {
      id: "logs",
      label: { en: "Logs", "pt-BR": "Logs" },
      description: { en: "Log aggregation.", "pt-BR": "Agregação de logs." },
      accent: { light: "#2f7d4f", dark: "#4fbf7f" },
    },
    {
      id: "tracing",
      label: { en: "Tracing", "pt-BR": "Rastreamento" },
      description: {
        en: "Distributed tracing and telemetry pipelines.",
        "pt-BR": "Rastreamento distribuído e pipelines de telemetria.",
      },
      accent: { light: "#6d4aff", dark: "#9a85ff" },
    },
  ],
  services: [
    {
      id: "prometheus",
      name: "Prometheus",
      category: "metrics",
      icon: "metrics",
      concepts: ["monitoring", "database"],
      description: {
        en: "Pull-based time-series metrics database.",
        "pt-BR": "Base de métricas em série temporal, por coleta.",
      },
    },
    {
      id: "grafana",
      name: "Grafana",
      category: "metrics",
      icon: "dashboard",
      concepts: ["monitoring"],
      searchKeys: ["dashboard", "painel"],
    },
    { id: "loki", name: "Loki", category: "logs", icon: "logs", concepts: ["monitoring"] },
    { id: "jaeger", name: "Jaeger", category: "tracing", icon: "traces", concepts: ["monitoring"] },
    {
      id: "otel-collector",
      name: "OpenTelemetry Collector",
      category: "tracing",
      icon: "collector",
      concepts: ["monitoring", "stream"],
      searchKeys: ["otel", "telemetry", "telemetria"],
    },
  ],
  icons: ICONS,
};

/** A shape for alert rules on the diagram: a bell-ish badge. */
export const ALERT_SHAPE: PluginShape = {
  id: "alert-rule",
  label: { en: "Alert rule", "pt-BR": "Regra de alerta" },
  description: {
    en: "A condition that pages someone; connect it to what it watches.",
    "pt-BR": "Uma condição que aciona alguém; conecte ao que ela observa.",
  },
  viewBox: "0 0 100 70",
  paths: [
    "M10 8 H90 Q96 8 96 14 V48 Q96 54 90 54 H58 L50 66 L42 54 H10 Q4 54 4 48 V14 Q4 8 10 8 Z",
  ],
  size: { width: 160, height: 112 },
  searchKeys: ["alert", "alerta", "alarm", "slo"],
};
