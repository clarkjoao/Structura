import { afterEach, describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { getElement, hasElement } from "@/features/elements/element.registry";
import { getCloudFamily } from "@/features/elements/families/cloud-family.registry";
import { registryCatalogEntries } from "@/features/elements/search";
import { searchElements } from "@/features/llm/element-catalog-query";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import { sanitizeComponentType } from "@/features/diagram/model/sanitize-component-type";
import type { ExportGeometry } from "@/features/elements/element.types";
import i18n from "@/infrastructure/i18n/i18n";
import fixture from "./__fixtures__/observability/pack.json";
import { packAccentCss } from "./pack.accents";
import { inlinePackIcons } from "./pack.icons";
import { registerElementPack, type RegisteredPack } from "./pack.loader";
import { parsePack } from "./pack.schema";

const rawIcons = import.meta.glob<string>("./__fixtures__/observability/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});
const icons = inlinePackIcons(
  Object.fromEntries(
    Object.entries(rawIcons).map(([file, svg]) => [
      file.split("/").pop()!.replace(".svg", ""),
      svg,
    ]),
  ),
);

const geometry: ExportGeometry = { id: "n1", parentId: null, x: 0, y: 0, width: 160, height: 80 };
const base = { id: "n1", name: "Metrics", description: "", parentId: null };

let registered: RegisteredPack | null = null;
const register = () => {
  registered = registerElementPack(parsePack(fixture), { icons });
  return registered;
};

afterEach(() => {
  registered?.unregister();
  registered = null;
});

describe("registerElementPack (namespaced pack)", () => {
  it("registers its categories and shapes under namespaced types", () => {
    const { typeIds } = register();
    expect(typeIds).toEqual([
      "observability/metrics",
      "observability/tracing",
      "observability/funnel",
    ]);
    expect(hasElement("observability/metrics")).toBe(true);
    expect(getElement("observability/funnel")?.canvas.role).toBe("custom-shape");
    // A namespaced id survives sanitization (rehydrate, import) like a plugin type.
    expect(sanitizeComponentType("observability/metrics")).toBe("observability/metrics");
  });

  it("offers the pack as a catalog group with its services and shape", () => {
    register();
    const { groups, entries } = registryCatalogEntries();
    expect(groups.find((group) => group.id === "observability")?.label).toBe(
      i18n.t("elements.observability.label"),
    );
    const labels = entries.filter((entry) => entry.groupId === "observability").map((e) => e.label);
    expect(labels).toEqual(expect.arrayContaining(["Prometheus", "Grafana"]));
    expect(labels).toContain(i18n.t("elements.observability.shapes.funnel.label"));
  });

  it("resolves its strings in both locales", async () => {
    register();
    expect(i18n.t("elements.observability.categories.metrics.label", { lng: "en" })).toBe(
      "Metrics",
    );
    await i18n.loadLanguages("pt-BR");
    expect(i18n.t("elements.observability.categories.metrics.label", { lng: "pt-BR" })).toBe(
      "Métricas",
    );
  });

  it("is searchable by the LLM and creates a typed component with its service", () => {
    register();
    const found = searchElements({ query: "prometheus", familyId: "observability" }).results;
    expect(found.some((row) => row.serviceId === "prometheus")).toBe(true);

    const component = getElement("observability/metrics")!.model.createComponent(base, {
      serviceId: "prometheus",
    });
    expect(component.type).toBe("observability/metrics");
    expect(resolveCloudServiceId(component)).toBe("prometheus");
  });

  it("exports a service as an image of its icon, and a shape as an image of its outline", () => {
    register();
    const card = getElement("observability/metrics")!;
    const node = card.export.drawio.toExportNode(
      card.model.createComponent(base, { serviceId: "prometheus" }),
      geometry,
    );
    expect(node.kind).toBe("image");

    const shape = getElement("observability/funnel")!;
    const outline = shape.export.drawio.toExportNode(
      shape.model.createComponent(base, {}),
      geometry,
    );
    expect(outline.kind).toBe("image");
  });

  it("falls back to passthrough for a category with no service icon", () => {
    register();
    const tracing = getElement("observability/tracing")!;
    const node = tracing.export.drawio.toExportNode(
      tracing.model.createComponent(base, {}),
      geometry,
    );
    expect(node.kind).toBe("passthrough");
  });

  it("writes accent tokens for light and dark plus their border classes", () => {
    const css = packAccentCss(parsePack(fixture));
    expect(css).toContain("--pack-observability-metrics: 12 79% 54%;");
    expect(css).toMatch(/\.dark \{[\s\S]*--pack-observability-metrics: 16 80% 60%;/);
    expect(css).toContain(".border-l-pack-observability-metrics");
    expect(getCloudFamily("observability")).toBeUndefined();
  });

  it("unregisters everything it registered", () => {
    register().unregister();
    registered = null;
    expect(hasElement("observability/metrics")).toBe(false);
    expect(hasElement("observability/funnel")).toBe(false);
    expect(getCloudFamily("observability")).toBeUndefined();
    expect(registryCatalogEntries().groups.some((group) => group.id === "observability")).toBe(
      false,
    );
  });

  it("refuses a pack that collides, registering nothing", () => {
    register();
    expect(() => registerElementPack(parsePack(fixture), { icons })).toThrow(/already registered/);
    expect(() =>
      registerElementPack(parsePack({ ...fixture, id: "aws", primaryCategories: undefined }), {
        icons,
      }),
    ).toThrow(/already registered/);
  });

  it("refuses a service whose icon the pack lacks", () => {
    expect(() => registerElementPack(parsePack(fixture))).toThrow(/icon "prometheus"/);
    expect(hasElement("observability/metrics")).toBe(false);
  });
});
