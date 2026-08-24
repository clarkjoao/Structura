import { describe, expect, it } from "vitest";
import type { AslIssueCode } from "./asl.types";
import { parseAslDocuments } from "./parse-asl";
import { validateAslDocuments } from "./asl-validator";

async function validate(source: string) {
  const parsed = await parseAslDocuments(source.trim());
  if (!parsed.ok) return { ok: false as const, issues: parsed.issues };
  return validateAslDocuments(parsed.documents);
}

function codes(result: Awaited<ReturnType<typeof validate>>): AslIssueCode[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

const QUEUE = `
apiVersion: arquitetura.itau/v1
kind: Queue
metadata:
  name: queue-a
spec:
  provider: SQS
`;

describe("validateAslDocuments", () => {
  it("accepts a minimal valid manifest", async () => {
    const result = await validate(QUEUE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifests).toHaveLength(1);
    expect(result.manifests[0].metadata.name).toBe("queue-a");
  });

  it("collects every issue instead of stopping at the first", async () => {
    const result = await validate(`
apiVersion: arquitetura.itau/v2
kind: Queue
metadata:
  name: Queue_A
spec:
  provider: SQS
`);
    expect(codes(result)).toEqual(
      expect.arrayContaining(["invalidApiVersion", "invalidName"]),
    );
  });

  it("rejects an unknown kind", async () => {
    const result = await validate(`
apiVersion: arquitetura.itau/v1
kind: Wormhole
metadata:
  name: w
spec: {}
`);
    expect(codes(result)).toContain("invalidKind");
  });

  it("rejects a duplicated metadata.name", async () => {
    const result = await validate(`${QUEUE}\n---${QUEUE}`);
    expect(codes(result)).toContain("duplicateName");
  });

  it("rejects a manifest missing a required spec field", async () => {
    const result = await validate(`
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-a
spec:
  language: Java
  description: "sem provider"
`);
    expect(codes(result)).toContain("missingSpecField");
    if (result.ok) return;
    expect(result.issues[0].params).toMatchObject({ field: "provider", name: "app-a" });
  });

  it("rejects an edge pointing at a manifest that does not exist", async () => {
    const result = await validate(`
${QUEUE}
---
apiVersion: arquitetura.itau/v1
kind: Relationship
metadata:
  name: rel
spec:
  edges:
    - from:
        kind: Queue
        id: queue-a
      to:
        kind: Application
        id: app-que-nao-existe
      type: triggers
`);
    expect(codes(result)).toContain("edgeEndpointNotFound");
  });

  it("rejects an endpoint whose declared kind disagrees with the manifest", async () => {
    const result = await validate(`
${QUEUE}
---
apiVersion: arquitetura.itau/v1
kind: Relationship
metadata:
  name: rel
spec:
  edges:
    - from:
        kind: Database
        id: queue-a
      to:
        kind: Queue
        id: queue-a
      type: reads
`);
    expect(codes(result)).toContain("edgeKindMismatch");
    if (result.ok) return;
    const mismatch = result.issues.find((issue) => issue.code === "edgeKindMismatch");
    expect(mismatch?.params).toMatchObject({ declared: "Database", resolved: "Queue" });
  });

  it("rejects an unknown relationship type", async () => {
    const result = await validate(`
${QUEUE}
---
apiVersion: arquitetura.itau/v1
kind: Relationship
metadata:
  name: rel
spec:
  edges:
    - from:
        kind: Queue
        id: queue-a
      to:
        kind: Queue
        id: queue-a
      type: teleports
`);
    expect(codes(result)).toContain("edgeInvalidType");
  });

  it("reports a containment cycle built from belongsTo edges", async () => {
    const result = await validate(`
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-a
spec:
  sigla: AAA
---
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-b
spec:
  sigla: BBB
---
apiVersion: arquitetura.itau/v1
kind: Relationship
metadata:
  name: rel
spec:
  edges:
    - from:
        kind: ApplicationService
        id: sa-a
      to:
        kind: ApplicationService
        id: sa-b
      type: belongsTo
    - from:
        kind: ApplicationService
        id: sa-b
      to:
        kind: ApplicationService
        id: sa-a
      type: belongsTo
`);
    expect(codes(result)).toContain("containmentCycle");
  });

  it("accepts an unexpected provider — that is the mapper's business, not a schema error", async () => {
    const result = await validate(`
apiVersion: arquitetura.itau/v1
kind: Queue
metadata:
  name: queue-a
spec:
  provider: RabbitMQ
`);
    expect(result.ok).toBe(true);
  });
});
