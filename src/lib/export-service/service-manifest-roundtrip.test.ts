import { describe, expect, it } from "vitest";
import type { Component, Diagram, ServiceDefinition } from "@/features/diagram";
import { ExternalLinkType } from "@/features/diagram";
import {
  allDiagramComponents,
  buildFallbackEntries,
  buildServiceRelinkPlan,
} from "@/features/integrations/service-matching";
import { validateDiagramFile } from "@/infrastructure/persistence/validateWorkspaceFile";
import { applyServiceRelink } from "@/pages/apply-service-relink";
import { exportJSON } from "./export-json";

function component(id: string, serviceId?: string, name = id): Component {
  return {
    id,
    name,
    description: "",
    parentId: null,
    type: "container",
    ...(serviceId ? { serviceId } : {}),
  } as Component;
}

function diagram(components: Component[]): Diagram {
  return {
    id: "d1",
    name: "Checkout flow",
    level: "container",
    createdAt: 1,
    updatedAt: 1,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: { c1: { elementId: "c1", x: 0, y: 0 } },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

const EXPORTING_SERVICE: ServiceDefinition = {
  id: "svc-in-workspace-a",
  name: "checkout",
  description: "Checkout API",
  repositoryUrl: "https://github.com/acme/checkout",
  technology: ["Node.js"],
  metadata: {
    github: { repoId: 42, fullName: "acme/checkout", topics: [], language: null, updatedAt: "" },
  },
};

/** The same service registered independently in the receiving workspace, under its own id. */
const RECEIVING_CATALOG: Record<string, ServiceDefinition> = {
  "svc-in-workspace-b": { ...EXPORTING_SERVICE, id: "svc-in-workspace-b" },
};

describe("service manifest round trip", () => {
  it("exports only the services the diagram references", () => {
    const json = exportJSON(diagram([component("c1", "svc-in-workspace-a"), component("c2")]), {
      [EXPORTING_SERVICE.id]: EXPORTING_SERVICE,
      unused: { ...EXPORTING_SERVICE, id: "unused", name: "billing" },
    });

    const parsed = JSON.parse(json) as { services?: Array<{ id: string }> };

    expect(parsed.services?.map((s) => s.id)).toEqual(["svc-in-workspace-a"]);
  });

  it("omits the manifest when no component links a service", () => {
    const json = exportJSON(diagram([component("c1")]), {
      [EXPORTING_SERVICE.id]: EXPORTING_SERVICE,
    });

    expect(JSON.parse(json)).not.toHaveProperty("services");
  });

  it("relinks a shared diagram to the receiving workspace's own service id", () => {
    const json = exportJSON(diagram([component("c1", "svc-in-workspace-a")]), {
      [EXPORTING_SERVICE.id]: EXPORTING_SERVICE,
    });

    const validation = validateDiagramFile(JSON.parse(json));
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;

    const components = allDiagramComponents(validation.diagram);
    const plan = buildServiceRelinkPlan({
      entries: validation.services ?? buildFallbackEntries(components),
      components,
      localCatalog: RECEIVING_CATALOG,
    });

    expect(plan.relink).toHaveLength(1);
    expect(plan.relink[0].service.id).toBe("svc-in-workspace-b");

    const relinked = applyServiceRelink(validation.diagram, {
      remap: { "svc-in-workspace-a": "svc-in-workspace-b" },
      clear: [],
    });

    expect(relinked.snapshot.components.c1.serviceId).toBe("svc-in-workspace-b");
  });

  it("imports a pre-manifest file without failing, falling back to component evidence", () => {
    // A file exported before the manifest existed: the envelope has no `services`, and the
    // component carries only what the store copied onto it when it was linked.
    const legacy = {
      $schema: "structura://diagrams/v1",
      schemaVersion: 1,
      data: diagram([
        {
          ...component("c1", "svc-in-workspace-a", "checkout"),
          externalLinks: [
            {
              id: "l1",
              label: "repo",
              url: "https://github.com/acme/checkout",
              type: ExternalLinkType.Github,
            },
          ],
        } as Component,
      ]),
    };

    const validation = validateDiagramFile(legacy);
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;
    expect(validation.services).toBeUndefined();

    const components = allDiagramComponents(validation.diagram);
    const plan = buildServiceRelinkPlan({
      entries: buildFallbackEntries(components),
      components,
      localCatalog: RECEIVING_CATALOG,
    });

    expect(plan.relink).toHaveLength(1);
    expect(plan.relink[0].signals).toEqual(expect.arrayContaining(["name", "component-link"]));
  });

  it("ignores a malformed manifest instead of feeding it to the matcher", () => {
    const validation = validateDiagramFile({
      $schema: "structura://diagrams/v1",
      schemaVersion: 1,
      data: diagram([component("c1", "svc-in-workspace-a")]),
      services: [{ name: "no id" }, "not an object", null],
    });

    expect(validation.valid).toBe(true);
    if (!validation.valid) return;
    expect(validation.services).toBeUndefined();
  });
});
