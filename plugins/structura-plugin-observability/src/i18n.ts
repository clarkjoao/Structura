export type Locale = "en" | "pt-BR";

const TEXT = {
  title: { en: "Observability", "pt-BR": "Observabilidade" },
  notOurs: {
    en: "Select a Prometheus, Grafana, Loki, Jaeger or OpenTelemetry element to configure it.",
    "pt-BR":
      "Selecione um elemento Prometheus, Grafana, Loki, Jaeger ou OpenTelemetry para configurá-lo.",
  },
  service: { en: "Service", "pt-BR": "Serviço" },
  retention: { en: "Retention", "pt-BR": "Retenção" },
  retentionHint: {
    en: "Written as a tag on the element.",
    "pt-BR": "Gravada como uma tag no elemento.",
  },
  days: { en: "{n} days", "pt-BR": "{n} dias" },
  alerting: { en: "Alerting", "pt-BR": "Alertas" },
  owner: { en: "On-call team", "pt-BR": "Time de plantão" },
  ownerPlaceholder: { en: "e.g. payments", "pt-BR": "ex.: pagamentos" },
  ownerError: {
    en: "Lowercase letters, digits and dashes.",
    "pt-BR": "Letras minúsculas, dígitos e hífens.",
  },
  apply: { en: "Apply", "pt-BR": "Aplicar" },
  reset: { en: "Reset", "pt-BR": "Desfazer" },
  applied: {
    en: "Observability settings applied",
    "pt-BR": "Configurações de observabilidade aplicadas",
  },
  tabSettings: { en: "Settings", "pt-BR": "Configurações" },
  tabTags: { en: "Tags", "pt-BR": "Tags" },
  noTags: { en: "No tags yet.", "pt-BR": "Nenhuma tag ainda." },
} satisfies Record<string, Record<Locale, string>>;

export function t(
  key: keyof typeof TEXT,
  locale: Locale,
  vars: Record<string, string | number> = {},
) {
  return TEXT[key][locale].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

export function localeOf(value: string): Locale {
  return value === "pt-BR" ? "pt-BR" : "en";
}
