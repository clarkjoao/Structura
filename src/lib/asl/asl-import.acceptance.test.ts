import { describe, expect, it } from "vitest";
import { readReferenceSolution } from "./asl-fixtures";
import { buildAslImportPlan } from "./asl-to-plan";
import { parseAslDocuments } from "./parse-asl";
import { validateAslDocuments } from "./asl-validator";
import type { AslImportPlan } from "./asl-plan";

/**
 * The acceptance fixture for the ASL importer (change `import-export-asl`,
 * Fatia 0).
 *
 * It states, item by item, what `/asl/example/solution.asl.yaml` must become
 * before any geometry is involved: which nodes exist, what each one is, who
 * sits inside the boundary, which relationships are drawn and — just as
 * important — which are not. Every later slice is measured against this.
 *
 * The containment rule it encodes was confirmed with the format's author:
 * an explicit `belongsTo` wins, otherwise the sigla convention
 * (`ApplicationService.sigla` + "-" prefixing `Application.siglaApp`),
 * otherwise a lone `ApplicationService` adopts the applications. Shared
 * infrastructure stays outside the boundary unless `belongsTo` says otherwise.
 */

async function planReference(): Promise<AslImportPlan> {
  const parsed = await parseAslDocuments(readReferenceSolution());
  expect(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.issues)).toBe(true);
  if (!parsed.ok) throw new Error("unreachable");

  const validated = validateAslDocuments(parsed.documents);
  expect(validated.ok, validated.ok ? "" : JSON.stringify(validated.issues)).toBe(true);
  if (!validated.ok) throw new Error("unreachable");

  return buildAslImportPlan(validated.manifests);
}

const SERVICE = "sa-proposal-consignado-tracking-clt";
const TRACKING_APP = "app-tracking-consignado";
const STREAM_APP = "app-proposal-consignado-stream-processor";
const DB = "tbjx9-trackingdb";
const QUEUE = "queue-update-tracking-proposal";
const TOPIC = "topic-proposal-status-events";
const RULE = "regra-tracking-consignado";

describe("ASL reference solution — accepted result", () => {
  it("parses and validates without a single issue", async () => {
    await planReference();
  });

  it("draws exactly the seven elements the document describes", async () => {
    const plan = await planReference();
    expect(plan.nodes.map((node) => node.key).sort()).toEqual(
      [SERVICE, TRACKING_APP, STREAM_APP, DB, QUEUE, TOPIC, RULE].sort(),
    );
  });

  it("makes the ApplicationService the boundary, named by its displayName", async () => {
    const plan = await planReference();
    const service = plan.nodes.find((node) => node.key === SERVICE);
    expect(service).toMatchObject({
      componentType: "panel",
      name: "SA Tracking de propostas de Consignado",
      parentKey: null,
      isContainer: true,
    });
    expect(service?.tags.sort()).toEqual(["domain:consignado", "tier:critical"]);
  });

  it("puts both applications inside the boundary, by sigla", async () => {
    const plan = await planReference();
    for (const key of [TRACKING_APP, STREAM_APP]) {
      expect(plan.nodes.find((node) => node.key === key)).toMatchObject({
        componentType: "aws-compute",
        cloudService: "lambda",
        technology: "Python",
        parentKey: SERVICE,
      });
    }
  });

  it("keeps shared infrastructure outside the boundary", async () => {
    const plan = await planReference();
    for (const key of [DB, QUEUE, TOPIC]) {
      expect(plan.nodes.find((node) => node.key === key)?.parentKey, key).toBeNull();
    }
  });

  it("gives each infrastructure node the right type and icon", async () => {
    const plan = await planReference();
    expect(plan.nodes.find((node) => node.key === DB)).toMatchObject({
      componentType: "aws-database",
      cloudService: "dynamodb",
    });
    expect(plan.nodes.find((node) => node.key === QUEUE)).toMatchObject({
      componentType: "aws-integration",
      cloudService: "sqs",
    });
  });

  it("draws the Kafka topic as a plain box rather than an Amazon MSK icon", async () => {
    const plan = await planReference();
    const topic = plan.nodes.find((node) => node.key === TOPIC);
    expect(topic).toMatchObject({ componentType: "container", technology: "Kafka" });
    expect(topic?.cloudService).toBeUndefined();
    expect(topic?.tags).toContain("type:Evento Interprocess");
  });

  it("turns the BusinessRule into an anchored note listing its constraints", async () => {
    const plan = await planReference();
    const note = plan.nodes.find((node) => node.key === RULE);
    expect(note?.componentType).toBe("note");
    expect(note?.anchorKey).toBe(TRACKING_APP);
    for (const constraint of ["RequireProposalId", "IdempotentUpdate", "ValidStatus"]) {
      expect(note?.description).toContain(constraint);
    }
    expect(note?.description).toContain("Retornar sucesso sem reprocessar");
  });

  it("draws the four flow relationships, in the document's direction", async () => {
    const plan = await planReference();
    expect(
      plan.edges.map((edge) => `${edge.sourceKey} -${edge.label}-> ${edge.targetKey}`),
    ).toEqual([
      `${QUEUE} -triggers-> ${TRACKING_APP}`,
      `${TRACKING_APP} -writes-> ${DB}`,
      `${DB} -triggers-> ${STREAM_APP}`,
      `${STREAM_APP} -publishes-> ${TOPIC}`,
    ]);
  });

  it("maps each relationship type onto a connection intent", async () => {
    const plan = await planReference();
    expect(plan.edges.map((edge) => edge.intent)).toEqual([
      "event",
      "data-flow",
      "event",
      "event",
    ]);
  });

  it("does not draw the appliesTo relationship as a flow edge", async () => {
    const plan = await planReference();
    expect(plan.edges.some((edge) => edge.sourceKey === RULE)).toBe(false);
    expect(plan.edges.some((edge) => edge.targetKey === SERVICE)).toBe(false);
  });

  it("keeps the prose out of the label and in the description", async () => {
    const plan = await planReference();
    const writes = plan.edges.find((edge) => edge.sourceKey === TRACKING_APP);
    expect(writes?.label).toBe("writes");
    expect(writes?.description).toBe("Persiste dados de rastreamento");
  });

  it("reports nothing to warn about", async () => {
    const plan = await planReference();
    expect(plan.warnings).toEqual([]);
  });
});
