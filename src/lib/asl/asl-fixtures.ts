import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ASL fixtures for tests. Test-only: it reads from disk and is never imported
 * by application code.
 *
 * The reference case is the real `/asl/example/solution.asl.yaml` rather than a
 * copy, so the importer is always measured against the document the format's
 * author actually wrote.
 */

import { buildAslImportPlan, type BuildAslPlanOptions } from "./asl-to-plan";
import type { AslImportPlan } from "./asl-plan";
import { parseAslDocuments } from "./parse-asl";
import { validateAslDocuments } from "./asl-validator";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Full pure pipeline: source text -> validated manifests -> import plan. */
export async function planFromSource(
  source: string,
  options?: BuildAslPlanOptions,
): Promise<AslImportPlan> {
  const parsed = await parseAslDocuments(source);
  if (!parsed.ok) throw new Error(`ASL parse failed: ${JSON.stringify(parsed.issues)}`);
  const validated = validateAslDocuments(parsed.documents);
  if (!validated.ok) throw new Error(`ASL invalid: ${JSON.stringify(validated.issues)}`);
  return buildAslImportPlan(validated.manifests, options);
}

export function readReferenceSolution(): string {
  return readFileSync(resolve(HERE, "../../../asl/example/solution.asl.yaml"), "utf8");
}

/** An ApplicationService with nothing inside it: the empty-boundary case. */
export const EMPTY_BOUNDARY_ASL = `
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-standby
spec:
  sigla: STB
  displayName: "SA Standby sem aplicações"
---
apiVersion: arquitetura.itau/v1
kind: Database
metadata:
  name: standby-db
spec:
  provider: RDSPostgres
  description: "Base de dados de contingência"
`.trim();

/** One application fanning out to five stores: the wide fan-out case. */
export const WIDE_FANOUT_ASL = `
apiVersion: arquitetura.itau/v1
kind: ApplicationService
metadata:
  name: sa-fanout
spec:
  sigla: FAN
  displayName: "SA Fan-out"
---
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-fanout
spec:
  provider: Lambda
  language: Python
  description: "Aplicação que escreve em vários destinos"
  siglaApp: FAN-X000
${[1, 2, 3, 4, 5]
  .map(
    (n) => `---
apiVersion: arquitetura.itau/v1
kind: Database
metadata:
  name: store-${n}
spec:
  provider: DynamoDB
  description: "Destino ${n}"`,
  )
  .join("\n")}
---
apiVersion: arquitetura.itau/v1
kind: Relationship
metadata:
  name: fanout-relationships
spec:
  edges:
${[1, 2, 3, 4, 5]
  .map(
    (n) => `    - from:
        kind: Application
        id: app-fanout
      to:
        kind: Database
        id: store-${n}
      type: writes
      description: "Persiste a projeção número ${n} do agregado de rastreamento"`,
  )
  .join("\n")}
`.trim();

/** Providers Structura has no icon for, plus an unknown one. */
export const OFF_CATALOG_PROVIDERS_ASL = `
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-legacy
spec:
  provider: OpenShift
  language: Java
  description: "Aplicação legada"
---
apiVersion: arquitetura.itau/v1
kind: Application
metadata:
  name: app-unmapped
spec:
  provider: Nomad
  language: Java
  description: "Aplicação em plataforma desconhecida"
---
apiVersion: arquitetura.itau/v1
kind: Queue
metadata:
  name: queue-legacy
spec:
  provider: IBM MQ
---
apiVersion: arquitetura.itau/v1
kind: Database
metadata:
  name: db-azure
spec:
  provider: CosmosDB
`.trim();
