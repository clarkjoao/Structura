import { afterEach, describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { getElement, hasElement } from "@/features/elements/element.registry";
import { registryCatalogEntries } from "@/features/elements/search";
import { searchElements } from "@/features/llm/element-catalog-query";
import {
  ALERT_SHAPE,
  OBSERVABILITY_PACK,
  PLUGIN_ID,
} from "../../../plugins/structura-plugin-observability/src/pack";
import {
  readSettings,
  writeSettings,
} from "../../../plugins/structura-plugin-observability/src/settings";
import type { PluginManifest } from "./plugin.types";
import {
  createContributionTracker,
  createScopedPluginApi,
  rollbackContributions,
  type PluginContributionTracker,
} from "./plugin-api";

/** The observability test plugin's pack and settings, against the real host API. */

const manifest: PluginManifest = {
  id: PLUGIN_ID,
  name: "Observability",
  version: "1.0.0",
  author: "Tests",
  description: "Observability test plugin",
  apiVersion: "^1.18",
  capabilities: ["canvas:elements", "ui:panels"],
};

let tracker: PluginContributionTracker;
afterEach(() => rollbackContributions(tracker));

describe("observability plugin", () => {
  it("registers its family and shape, offered in the catalog and to the assistant", () => {
    tracker = createContributionTracker();
    const api = createScopedPluginApi(manifest, tracker, new InMemoryAdapter());
    api.registerElementPack(OBSERVABILITY_PACK);
    api.registerShape(ALERT_SHAPE);

    for (const id of ["metrics", "logs", "tracing", "alert-rule"]) {
      expect(hasElement(`${PLUGIN_ID}/${id}`), id).toBe(true);
    }
    const labels = registryCatalogEntries()
      .entries.filter((entry) => entry.groupId === PLUGIN_ID)
      .map((entry) => entry.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Prometheus",
        "Grafana",
        "Loki",
        "Jaeger",
        "OpenTelemetry Collector",
      ]),
    );
    expect(
      searchElements({ query: "otel", familyId: PLUGIN_ID }).results.some(
        (row) => row.serviceId === "otel-collector",
      ),
    ).toBe(true);
    const prometheus = getElement(`${PLUGIN_ID}/metrics`)!.model.createComponent(
      { id: "p1", name: "Prometheus", description: "", parentId: null },
      { serviceId: "prometheus" },
    );
    expect(prometheus.type).toBe(`${PLUGIN_ID}/metrics`);
  });

  it("stores its settings as tags, keeping the element's other tags", () => {
    const tags = writeSettings(["team:core", "retention:7d", "oncall:old"], {
      retentionDays: "90",
      alerting: true,
      oncall: "payments",
    });
    expect(tags).toEqual(["team:core", "retention:90d", "alerting", "oncall:payments"]);
    expect(readSettings(tags)).toEqual({ retentionDays: "90", alerting: true, oncall: "payments" });
    expect(readSettings([])).toEqual({ retentionDays: "30", alerting: false, oncall: "" });
  });
});
