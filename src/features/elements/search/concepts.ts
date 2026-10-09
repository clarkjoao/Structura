import i18n from "@/infrastructure/i18n";

/**
 * What an element *is*, independent of what any vendor calls it.
 *
 * A palette's `searchKeys` are names and abbreviations — locale-free words a
 * user types when they already know the product. A concept is the word they
 * type when they know the job: "fila" should find SQS, Service Bus and Kafka
 * though none of them is called that. Its terms live in i18n
 * (`elementCatalog.concepts.<id>`, `|`-separated) and every locale's terms
 * are searched at once, so a pt-BR user typing "queue" still gets there.
 */
export const CATALOG_CONCEPTS = [
  "queue",
  "events",
  "database",
  "cache",
  "object-storage",
  "api-gateway",
  "load-balancer",
  "cdn",
  "identity",
  "secrets",
  "serverless",
  "monitoring",
  "dns",
  // Finer roles the pattern catalog resolves to a provider service: one
  // service each, where the coarse ones above ("events", "database") would
  // not say which.
  "topic",
  "event-bus",
  "stream",
  "relational-db",
  "nosql-db",
  "warehouse",
  "workflow",
] as const;

export type CatalogConceptId = (typeof CATALOG_CONCEPTS)[number];

function conceptKey(id: CatalogConceptId): string {
  return `elementCatalog.concepts.${id}`;
}

/** Every locale the app ships, read from i18n rather than written out. */
function shippedLanguages(): string[] {
  return Object.keys(i18n.options.resources ?? {});
}

/**
 * The terms a concept matches on, from every shipped locale, de-duplicated.
 * A missing entry yields nothing rather than the raw key.
 */
export function conceptTerms(id: CatalogConceptId): string[] {
  const key = conceptKey(id);
  const terms = new Set<string>();
  for (const lng of shippedLanguages()) {
    const raw = i18n.t(key, { lng });
    if (raw === key) continue;
    for (const term of raw.split("|")) {
      const trimmed = term.trim();
      if (trimmed) terms.add(trimmed);
    }
  }
  return [...terms];
}
