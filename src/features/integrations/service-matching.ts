import type {
  Component,
  Diagram,
  ServiceDefinition,
  ServiceManifestEntry,
} from "@/features/diagram";
import { normalizeRepoUrl, repoUrlsMatch } from "./merge-utils";

/** Independent pieces of evidence that a local service is the same one the file references. */
export type ServiceMatchSignal =
  "github-repo-id" | "repository-url" | "name" | "github-full-name" | "component-link";

/** Two independent signals is the bar: one alone (a shared name) matches too many services. */
const REQUIRED_SIGNALS = 2;

export type ServiceMatch =
  | { kind: "match"; service: ServiceDefinition; signals: ServiceMatchSignal[] }
  | { kind: "ambiguous"; candidates: ServiceDefinition[] }
  | { kind: "none" };

export interface ServiceRelinkPlan {
  /** Entries whose id already exists in the receiving catalog — nothing to do. */
  alreadyLocal: ServiceManifestEntry[];
  /** Entries matched to a local service under a different id. */
  relink: Array<{
    entry: ServiceManifestEntry;
    service: ServiceDefinition;
    signals: ServiceMatchSignal[];
    componentIds: string[];
  }>;
  /** Entries with no confident match, including the ambiguous ones. */
  unmatched: Array<{
    entry: ServiceManifestEntry;
    ambiguousCandidates: ServiceDefinition[];
    componentIds: string[];
  }>;
}

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function collectSignals(
  entry: ServiceManifestEntry,
  service: ServiceDefinition,
  componentLinkUrls: string[],
): ServiceMatchSignal[] {
  const signals: ServiceMatchSignal[] = [];

  const localRepoId = service.metadata?.github?.repoId;
  if (entry.github?.repoId !== undefined && entry.github.repoId === localRepoId) {
    signals.push("github-repo-id");
  }

  if (repoUrlsMatch(service.repositoryUrl, entry.repositoryUrl)) {
    signals.push("repository-url");
  }

  const entryName = normalizeName(entry.name);
  if (entryName !== "" && entryName === normalizeName(service.name)) {
    signals.push("name");
  }

  const localFullName = normalizeName(service.metadata?.github?.fullName);
  const entryFullName = normalizeName(entry.github?.fullName);
  if (entryFullName !== "" && entryFullName === localFullName) {
    signals.push("github-full-name");
  }

  const localRepo = normalizeRepoUrl(service.repositoryUrl);
  if (localRepo !== "" && componentLinkUrls.some((url) => normalizeRepoUrl(url) === localRepo)) {
    signals.push("component-link");
  }

  return signals;
}

/**
 * Match one manifest entry against the receiving workspace's catalog.
 *
 * A candidate qualifies only with at least {@link REQUIRED_SIGNALS} independent signals **and**
 * only when it is the sole top scorer. A tie is reported as ambiguous rather than guessed —
 * silently relinking a component to the wrong service is worse than leaving it unlinked.
 */
export function matchServiceEntry(
  entry: ServiceManifestEntry,
  localServices: ServiceDefinition[],
  componentLinkUrls: string[] = [],
): ServiceMatch {
  const scored = localServices
    .map((service) => ({ service, signals: collectSignals(entry, service, componentLinkUrls) }))
    .filter(({ signals }) => signals.length >= REQUIRED_SIGNALS);

  if (scored.length === 0) return { kind: "none" };

  const best = Math.max(...scored.map(({ signals }) => signals.length));
  const top = scored.filter(({ signals }) => signals.length === best);

  if (top.length > 1) {
    return { kind: "ambiguous", candidates: top.map(({ service }) => service) };
  }

  return { kind: "match", service: top[0].service, signals: top[0].signals };
}

function componentsByServiceId(components: Component[]): Map<string, Component[]> {
  const grouped = new Map<string, Component[]>();
  for (const component of components) {
    const serviceId = component.serviceId;
    if (!serviceId) continue;
    const bucket = grouped.get(serviceId);
    if (bucket) bucket.push(component);
    else grouped.set(serviceId, [component]);
  }
  return grouped;
}

/** Every component in the file, including the ones only present inside a scene. */
export function allDiagramComponents(diagram: Diagram): Component[] {
  const components = Object.values(diagram.snapshot?.components ?? {});
  for (const scene of Object.values(diagram.scenes ?? {})) {
    components.push(...Object.values(scene.addedComponents ?? {}));
  }
  return components;
}

/**
 * Files exported before the manifest existed carry no service identity, only the fields the
 * store copies onto a linked component: its name, its external links and its technology. That
 * is weaker evidence, and the two-signal rule turns it into fewer matches rather than wrong
 * ones.
 */
export function buildFallbackEntries(components: Component[]): ServiceManifestEntry[] {
  const entries: ServiceManifestEntry[] = [];

  for (const [serviceId, linked] of componentsByServiceId(components)) {
    const sample = linked[0];
    const technology =
      "technology" in sample && typeof sample.technology === "string" && sample.technology
        ? sample.technology.split(",").map((part) => part.trim())
        : [];

    entries.push({
      id: serviceId,
      name: sample.name,
      repositoryUrl: "",
      technology,
      ...(sample.tags?.length ? { tags: sample.tags } : {}),
    });
  }

  return entries;
}

interface BuildRelinkPlanParams {
  /** Entries from the file's manifest, or the fallback entries when it has none. */
  entries: ServiceManifestEntry[];
  components: Component[];
  localCatalog: Record<string, ServiceDefinition>;
}

export function buildServiceRelinkPlan({
  entries,
  components,
  localCatalog,
}: BuildRelinkPlanParams): ServiceRelinkPlan {
  const localServices = Object.values(localCatalog);
  const grouped = componentsByServiceId(components);
  const plan: ServiceRelinkPlan = { alreadyLocal: [], relink: [], unmatched: [] };

  for (const entry of entries) {
    const linked = grouped.get(entry.id) ?? [];
    const componentIds = linked.map((component) => component.id);

    if (localCatalog[entry.id]) {
      plan.alreadyLocal.push(entry);
      continue;
    }

    const componentLinkUrls = linked.flatMap((component) =>
      (component.externalLinks ?? []).map((link) => link.url),
    );
    const match = matchServiceEntry(entry, localServices, componentLinkUrls);

    if (match.kind === "match") {
      plan.relink.push({
        entry,
        service: match.service,
        signals: match.signals,
        componentIds,
      });
      continue;
    }

    plan.unmatched.push({
      entry,
      ambiguousCandidates: match.kind === "ambiguous" ? match.candidates : [],
      componentIds,
    });
  }

  return plan;
}

/** True when the plan has anything worth showing the user. */
export function planNeedsReview(plan: ServiceRelinkPlan): boolean {
  return plan.relink.length > 0 || plan.unmatched.length > 0;
}
