import type { AslManifest } from "./asl.types";

/**
 * Containment derivation.
 *
 * No ASL schema declares a parent field, so the hierarchy has to be inferred.
 * Three signals exist, and they are applied as a cascade — the first that
 * matches wins:
 *
 *   1. an explicit `belongsTo` relationship edge;
 *   2. the sigla convention — an `Application` whose `siglaApp` starts with an
 *      `ApplicationService`'s `sigla` followed by `-` (JX9 / JX9-X000);
 *   3. a single `ApplicationService` in the file adopts the applications;
 *   4. otherwise the node is a root.
 *
 * Rules 2 and 3 apply to applications only. Databases, queues, topics and
 * gateways are shared infrastructure: placing them inside a service boundary
 * would assert an ownership the document never states, so they stay outside
 * unless a `belongsTo` says otherwise.
 */

function readString(spec: Record<string, unknown>, field: string): string | undefined {
  const value = spec[field];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

interface ServiceSigla {
  name: string;
  sigla: string;
}

function applicationServices(manifests: readonly AslManifest[]): AslManifest[] {
  return manifests.filter((manifest) => manifest.kind === "ApplicationService");
}

function siglas(services: readonly AslManifest[]): ServiceSigla[] {
  return services.flatMap((service) => {
    const sigla = readString(service.spec, "sigla");
    return sigla !== undefined ? [{ name: service.metadata.name, sigla }] : [];
  });
}

/**
 * Longest sigla first, so `JX9A-X000` prefers the `JX9A` service over `JX9`
 * when both are present.
 */
function matchBySigla(siglaApp: string, table: readonly ServiceSigla[]): string | undefined {
  return [...table]
    .sort((a, b) => b.sigla.length - a.sigla.length)
    .find((entry) => siglaApp.startsWith(`${entry.sigla}-`))?.name;
}

/**
 * Resolves the parent of every manifest, keyed by `metadata.name`.
 * Absent from the map means "root".
 */
export function deriveParentKeys(
  manifests: readonly AslManifest[],
  belongsTo: ReadonlyMap<string, string>,
): Map<string, string> {
  const parents = new Map<string, string>();
  const services = applicationServices(manifests);
  const siglaTable = siglas(services);
  const soleService = services.length === 1 ? services[0].metadata.name : undefined;

  for (const manifest of manifests) {
    const name = manifest.metadata.name;

    const explicit = belongsTo.get(name);
    if (explicit !== undefined && explicit !== name) {
      parents.set(name, explicit);
      continue;
    }

    if (manifest.kind !== "Application") continue;

    const siglaApp = readString(manifest.spec, "siglaApp");
    const bySigla = siglaApp !== undefined ? matchBySigla(siglaApp, siglaTable) : undefined;
    if (bySigla !== undefined && bySigla !== name) {
      parents.set(name, bySigla);
      continue;
    }

    if (soleService !== undefined && soleService !== name) {
      parents.set(name, soleService);
    }
  }

  return parents;
}
