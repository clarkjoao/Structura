import i18n from "@/infrastructure/i18n";
import { PATTERNS } from "@/lib/catalogs/patterns";
import {
  patternDescriptionKey,
  patternNameKey,
  patternProviders,
} from "@/features/elements/patterns";

/** The model reads the catalog in English, like the element catalog. */
const CATALOG_LOCALE = "en";

export interface PatternCatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Infrastructure roles the pattern draws; each becomes the provider's service. */
  roles: string[];
}

export interface ListPatternsResult {
  patterns: PatternCatalogEntry[];
  /** Values `insert_pattern.provider` accepts. */
  providers: string[];
}

/**
 * The `list_patterns` result, derived from the catalog at call time (the
 * registry is empty when the LLM chunk loads).
 */
export function listPatterns(): ListPatternsResult {
  const t = (key: string) => i18n.t(key, { lng: CATALOG_LOCALE });
  return {
    patterns: PATTERNS.map((pattern) => ({
      id: pattern.id,
      name: t(patternNameKey(pattern)),
      category: pattern.category,
      description: t(patternDescriptionKey(pattern)),
      roles: [...new Set(pattern.nodes.flatMap((node) => (node.role ? [node.role] : [])))],
    })),
    providers: patternProviders(),
  };
}
