import { getElement, offeredElements } from "@/features/elements/element.registry";
import {
  allCloudFamilies,
  familyOwnElements,
  nonCatalogFamilyIds,
} from "@/features/elements/families/cloud-family.registry";
import type { Component } from "@/features/diagram/model/component.types";
import type { ElementDescriptor } from "@/features/elements/element.types";
import { conceptTerms } from "@/features/elements/search/concepts";
import { fold } from "@/features/elements/search/normalize";
import i18n from "@/infrastructure/i18n";

const CATALOG_LOCALE = "en";

export interface ElementFamilyCategorySummary {
  id: string;
  label: string;
  serviceCount: number;
}

export interface ElementFamilySummary {
  id: string;
  label: string;
  elementCount: number;
  categories: ElementFamilyCategorySummary[];
}

export interface ListElementFamiliesResult {
  families: ElementFamilySummary[];
  diagramFamilyMix: Array<{ familyId: string; nodes: number }>;
}

export interface SearchElementsResultItem {
  elementType: string;
  /** Create-time service id (`add_node.awsService` → `cloudServiceId`). */
  serviceId: string | null;
  familyId: string;
  label: string;
  description: string;
  requiredFields: string[];
}

export interface SearchElementsResult {
  results: SearchElementsResultItem[];
  truncated: boolean;
}

function t(key: string): string {
  return i18n.t(key, { lng: CATALOG_LOCALE });
}

/** Count nodes in the active diagram snapshot by element-registry family. */
export function computeDiagramFamilyMix(
  components: Record<string, Component>,
): Array<{ familyId: string; nodes: number }> {
  const counts = new Map<string, number>();
  for (const component of Object.values(components)) {
    const family = getElement(component.type)?.family ?? "unknown";
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([familyId, nodes]) => ({ familyId, nodes }))
    .sort((a, b) => b.nodes - a.nodes || a.familyId.localeCompare(b.familyId));
}

/**
 * Display label for a family that is not catalog-shaped.
 *
 * Catalog families carry their own `labelKey`; `structural`, `c4` and anything
 * a future vocabulary registers do not, so the key is a convention. i18next
 * returns the key itself when there is no entry, which would put
 * `elements.families.bpmn.label` in front of the model — fall back to the
 * family id instead, so a new family is merely unlabelled, never broken.
 */
function familyLabel(familyId: string): string {
  const key = `elements.families.${familyId}.label`;
  const translated = t(key);
  return translated === key ? familyId : translated;
}

/**
 * Families + categories for the hierarchical LLM catalog (decision 10).
 *
 * Services are intentionally omitted — callers must use `searchElements`.
 *
 * Both halves are derived. `"structural"` and `"c4"` used to be written out
 * here as literals with English labels, so a family registered through
 * `registerElement` with any other id — a BPMN or UML vocabulary, say — was
 * invisible to the model: it rendered on the canvas and the assistant could
 * not name it.
 */
export function listElementFamilies(
  components: Record<string, Component> = {},
): ListElementFamiliesResult {
  const families: ElementFamilySummary[] = nonCatalogFamilyIds().map((familyId) => ({
    id: familyId,
    label: familyLabel(familyId),
    elementCount: offeredElements().filter((element) => element.family === familyId).length,
    categories: [],
  }));

  for (const family of allCloudFamilies()) {
    const categories = family.categories.map((category) => ({
      id: category.id,
      label: t(category.labelKey),
      serviceCount: family.services.filter((service) => service.categoryId === category.id).length,
    }));
    families.push({
      id: family.id,
      label: t(family.labelKey),
      elementCount: family.services.length + familyOwnElements(family.id).length,
      categories,
    });
  }

  return {
    families,
    diagramFamilyMix: computeDiagramFamilyMix(components),
  };
}

/** Words a query carries that say nothing about which element it wants. */
const QUERY_STOPWORDS = new Set([
  "amazon",
  "aws",
  "azure",
  "google",
  "gcp",
  "cloud",
  "service",
  "services",
  "the",
  "of",
  "for",
  "and",
]);

/** Longer words match on their first letters: "balancer" finds "Balancing". */
const STEM_LENGTH = 5;

/** Folded, with every space and dash dropped: "Elastic Container Service" meets an icon name. */
function compact(text: string): string {
  return fold(text).replace(/[^a-z0-9]+/g, "");
}

function queryTokens(query: string): string[] {
  return fold(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !QUERY_STOPWORDS.has(token))
    .map((token) => (token.length > STEM_LENGTH ? token.slice(0, STEM_LENGTH) : token));
}

/**
 * The keys an entry is found by. `names` are what it is called (id, label,
 * icon name, synonyms, concept terms); `all` adds the descriptions.
 */
interface SearchKeys {
  names: readonly string[];
  all: readonly string[];
}

/** A name made of several words ("load balancer"), which a query may contain whole. */
function isPhrase(name: string): boolean {
  return /\s/.test(name.trim());
}

/**
 * How an entry matches the whole query: 2 when one of its names does — it
 * contains the query (spaces and dashes aside), or the query contains one of
 * its multi-word names ("Application Load Balancer" holds "load balancer") —
 * 1 when only a description does, 0 when nothing does.
 */
function queryMatch(keys: SearchKeys, query: string): number {
  const folded = fold(query);
  const compacted = compact(query);
  const byName = keys.names.some((key) => {
    const name = compact(key);
    return name.includes(compacted) || (isPhrase(key) && compacted.includes(name));
  });
  if (byName) return 2;
  return keys.all.some((key) => fold(key).includes(folded)) ? 1 : 0;
}

/** The words of an entry's names, camel-case icon names split too. */
function nameWords(keys: SearchKeys): string[] {
  return keys.names.flatMap((name) =>
    fold(name.replace(/([a-z])([A-Z])/g, "$1 $2"))
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

/** How many of the query's words start a word of the entry's names. */
function tokenScore(keys: SearchKeys, tokens: readonly string[]): number {
  const words = nameWords(keys);
  return tokens.filter((token) => words.some((word) => word.startsWith(token))).length;
}

/**
 * Text search over structural/C4 elements and cloud-family services.
 *
 * Returns `elementType` + `serviceId` ready for `add_node` (serviceId maps to
 * the shared `awsService` parameter → `cloudServiceId`).
 */
export function searchElements(params: {
  query: string;
  familyId?: string;
  categoryId?: string;
  limit?: number;
}): SearchElementsResult {
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 50);
  const query = params.query.trim();
  const candidates: { item: SearchElementsResultItem; keys: SearchKeys }[] = [];

  if (!query) {
    return { results: [], truncated: false };
  }

  const pushElements = (familyFilter: string, elements: readonly ElementDescriptor[]) => {
    if (params.familyId && params.familyId !== familyFilter) return;
    if (params.categoryId) return;
    for (const element of elements) {
      const label = t(element.labelKey);
      const description = t(element.descriptionKey);
      const names = [
        element.id,
        label,
        ...(element.palette.searchKeys ?? []),
        ...(element.palette.concepts ?? []).flatMap(conceptTerms),
      ];
      candidates.push({
        keys: { names, all: [...names, description] },
        item: {
          elementType: element.id,
          serviceId: null,
          familyId: familyFilter,
          label,
          description,
          requiredFields: element.model.requiredFields ? [...element.model.requiredFields] : [],
        },
      });
    }
  };

  // Every non-catalog family, not just the two that existed when this was
  // written — a new vocabulary is searchable the moment it registers.
  for (const familyId of nonCatalogFamilyIds()) {
    pushElements(
      familyId,
      offeredElements().filter((entry) => entry.family === familyId),
    );
  }

  for (const family of allCloudFamilies()) {
    if (params.familyId && params.familyId !== family.id) continue;
    // A catalog family's own elements (typed containers and the like) come first.
    pushElements(family.id, familyOwnElements(family.id));
    for (const category of family.categories) {
      if (params.categoryId && params.categoryId !== category.id) continue;
      const categoryLabel = t(category.labelKey);
      const categoryDescription = t(category.descriptionKey);
      const services = family.services.filter((service) => service.categoryId === category.id);
      for (const service of services) {
        // A service may describe itself; otherwise it inherits the category's
        // line. Without this the model saw the same sentence for every service
        // in a category — "AWS compute services (EC2, Lambda, …)" as the
        // description of both EC2 and Lambda.
        const description = service.descriptionKey
          ? t(service.descriptionKey)
          : categoryDescription;
        const names = [
          service.id,
          service.name,
          service.iconName,
          ...(service.concepts ?? []).flatMap(conceptTerms),
        ];
        candidates.push({
          keys: {
            names,
            all: [
              ...names,
              description,
              category.id,
              categoryLabel,
              categoryDescription,
              family.id,
            ],
          },
          item: {
            elementType: category.id,
            serviceId: service.id,
            familyId: family.id,
            label: service.name,
            description,
            requiredFields: [],
          },
        });
      }
    }
  }

  // Entries matched by name first, then those only a description matched.
  let results = candidates
    .map((candidate) => ({ item: candidate.item, match: queryMatch(candidate.keys, query) }))
    .filter((entry) => entry.match > 0)
    .sort((a, b) => b.match - a.match)
    .map((entry) => entry.item);
  if (results.length === 0) {
    // No entry holds the whole query ("Elastic Container Service Fargate"):
    // keep the ones that hold the most of its words.
    const tokens = queryTokens(query);
    const scored = candidates.map((candidate) => ({
      item: candidate.item,
      score: tokenScore(candidate.keys, tokens),
    }));
    const best = Math.max(0, ...scored.map((entry) => entry.score));
    results = best === 0 ? [] : scored.filter((entry) => entry.score === best).map((e) => e.item);
  }

  const truncated = results.length > limit;
  return {
    results: results.slice(0, limit),
    truncated,
  };
}
