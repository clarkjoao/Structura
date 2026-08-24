import { describe, expect, it } from "vitest";
import {
  EMPTY_BOUNDARY_ASL,
  OFF_CATALOG_PROVIDERS_ASL,
  planFromSource,
  readReferenceSolution,
} from "./asl-fixtures";

describe("buildAslImportPlan — containment", () => {
  it("keeps an ApplicationService with no applications as an empty container", async () => {
    const plan = await planFromSource(EMPTY_BOUNDARY_ASL);
    const service = plan.nodes.find((node) => node.key === "sa-standby");
    expect(service).toMatchObject({ componentType: "panel", isContainer: true });
    expect(plan.nodes.filter((node) => node.parentKey === "sa-standby")).toHaveLength(0);
  });

  it("prefers an explicit belongsTo over the sigla convention", async () => {
    const plan = await planFromSource(`
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-one
spec:
  sigla: ONE
---
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-two
spec:
  sigla: TWO
---
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-a
spec:
  provider: Lambda
  language: Python
  description: "app"
  siglaApp: ONE-X000
---
apiVersion: arquitetura.itau/v1
kind: Relationship
metadata:
  name: rel
spec:
  edges:
    - from:
        kind: Application
        id: app-a
      to:
        kind: ApplicationService
        id: sa-two
      type: belongsTo
`);
    expect(plan.nodes.find((node) => node.key === "app-a")?.parentKey).toBe("sa-two");
  });

  it("leaves applications at the root when several services offer no signal", async () => {
    const plan = await planFromSource(`
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-one
spec:
  sigla: ONE
---
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-two
spec:
  sigla: TWO
---
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-orphan
spec:
  provider: Lambda
  language: Python
  description: "app sem sigla"
`);
    expect(plan.nodes.find((node) => node.key === "app-orphan")?.parentKey).toBeNull();
  });

  it("marks a node that ended up with children as a container", async () => {
    const plan = await planFromSource(`
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-host
spec:
  provider: EKS
  language: Java
  description: "host"
---
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-guest
spec:
  provider: Lambda
  language: Python
  description: "guest"
---
apiVersion: arquitetura.itau/v1
kind: Relationship
metadata:
  name: rel
spec:
  edges:
    - from:
        kind: Application
        id: app-guest
      to:
        kind: Application
        id: app-host
      type: belongsTo
`);
    expect(plan.nodes.find((node) => node.key === "app-host")?.isContainer).toBe(true);
    expect(plan.nodes.find((node) => node.key === "app-guest")?.isContainer).toBe(false);
  });
});

describe("buildAslImportPlan — providers off the catalog", () => {
  it("degrades to a plain box carrying the provider, and only warns for the unknown one", async () => {
    const plan = await planFromSource(OFF_CATALOG_PROVIDERS_ASL);

    expect(plan.nodes.find((node) => node.key === "app-legacy")).toMatchObject({
      componentType: "container",
      technology: "OpenShift",
    });
    expect(plan.nodes.find((node) => node.key === "queue-legacy")).toMatchObject({
      componentType: "container",
      technology: "IBM MQ",
    });
    expect(plan.nodes.find((node) => node.key === "app-unmapped")).toMatchObject({
      componentType: "container",
      technology: "Nomad",
    });

    const warned = plan.warnings.filter((warning) => warning.code === "unknownProvider");
    expect(warned).toHaveLength(1);
    expect(warned[0].params).toMatchObject({ name: "app-unmapped", value: "Nomad" });
  });

  it("routes CosmosDB through the Azure catalog", async () => {
    const plan = await planFromSource(OFF_CATALOG_PROVIDERS_ASL);
    expect(plan.nodes.find((node) => node.key === "db-azure")).toMatchObject({
      componentType: "azure-database",
      cloudService: "cosmosdb",
    });
  });
});

describe("buildAslImportPlan — organisation kinds", () => {
  it("skips squads and communities and says how many", async () => {
    const plan = await planFromSource(`
apiVersion: arquitetura.itau/v1
kind: Squad
metadata:
  name: squad-tracking
spec:
  code: SQ1
---
apiVersion: arquitetura.itau/v1
kind: Community
metadata:
  name: comunidade-consignado
spec:
  code: CM1
---
apiVersion: arquitetura.itau/v1
kind: Queue
metadata:
  name: queue-a
spec:
  provider: SQS
`);
    expect(plan.nodes.map((node) => node.key)).toEqual(["queue-a"]);
    expect(plan.warnings).toContainEqual({
      code: "skippedOrganizationKinds",
      params: { count: 2 },
    });
  });
});

describe("buildAslImportPlan — business layer", () => {
  it("draws a business capability as a note anchored to the solution", async () => {
    const plan = await planFromSource(`
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-one
spec:
  sigla: ONE
  displayName: "Serviço"
---
apiVersion: arquitetura.itau/v1
kind: BusinessCapability
metadata:
  name: cap-consignado
spec:
  description: "Concessão de crédito consignado"
  displayName: "Crédito Consignado"
`);
    expect(plan.nodes.find((node) => node.key === "cap-consignado")).toMatchObject({
      componentType: "note",
      name: "Crédito Consignado",
      description: "Concessão de crédito consignado",
      anchorKey: "sa-one",
    });
  });

  it("warns when a note has nothing to anchor to", async () => {
    const plan = await planFromSource(`
apiVersion: arquitetura.itau/v1
kind: BusinessService
metadata:
  name: svc-solto
spec:
  description: "Sem alvo"
`);
    expect(plan.nodes.find((node) => node.key === "svc-solto")?.anchorKey).toBeUndefined();
    expect(plan.warnings.map((warning) => warning.code)).toContain("unanchoredNote");
  });
});

describe("buildAslImportPlan — edge labels", () => {
  it("can be asked for the full description instead of the verb", async () => {
    const plan = await planFromSource(readReferenceSolution(), { edgeLabel: "description" });
    expect(plan.edges[0].label).toBe(
      "SQS dispara o processamento das atualizações de tracking",
    );
  });
});
