import {
  PATTERN_CATEGORIES,
  PATTERNS,
  type PatternCategory,
  type PatternTemplate,
} from "@/lib/catalogs/patterns";
import type { UserTemplate } from "@/features/diagram";
import { CATALOG_CONCEPTS, conceptTerms, fold } from "@/features/elements/search";

/** A pattern sub-filter: every pattern, the user's saved templates, or one built-in category. */
export type PatternFilter = "all" | "user-templates" | PatternCategory;

export const PATTERN_FILTERS: readonly PatternFilter[] = [
  "all",
  "user-templates",
  ...PATTERN_CATEGORIES,
];

interface Searchable {
  name: string;
  description?: string;
  category?: string;
  components: readonly { name: string }[];
}

/** Shortest query that is also read as a concept: shorter ones match too much. */
const MIN_CONCEPT_QUERY = 3;

/**
 * The query and, when it names a catalog concept in any locale, that
 * concept's other terms — the built-in patterns are written in English, and
 * "fila" should still find the queue patterns.
 */
function needlesFor(query: string): string[] {
  const q = fold(query.trim());
  if (!q) return [];
  const needles = new Set([q]);
  if (q.length >= MIN_CONCEPT_QUERY) {
    for (const concept of CATALOG_CONCEPTS) {
      const terms = conceptTerms(concept).map(fold);
      if (!terms.some((term) => term.startsWith(q))) continue;
      // Short terms ("db", "lb") would match inside unrelated words.
      for (const term of terms) if (term.length >= MIN_CONCEPT_QUERY) needles.add(term);
    }
  }
  return [...needles];
}

function matchesNeedles(pattern: Searchable, needles: readonly string[]): boolean {
  if (needles.length === 0) return true;
  const haystack = [
    pattern.name,
    pattern.description ?? "",
    pattern.category ?? "",
    ...pattern.components.map((component) => component.name),
  ].map(fold);
  return needles.some((needle) => haystack.some((text) => text.includes(needle)));
}

/** Name, description, category or any component's name — accent- and case-insensitive. */
export function patternMatches(pattern: Searchable, query: string): boolean {
  return matchesNeedles(pattern, needlesFor(query));
}

export interface PatternSearchResult {
  builtins: PatternTemplate[];
  userTemplates: UserTemplate[];
  /** Matches per filter chip. */
  counts: Record<PatternFilter, number>;
}

/** Built-in patterns and saved templates matching `query`, with the count each chip shows. */
export function searchPatterns(
  query: string,
  userTemplates: readonly UserTemplate[],
): PatternSearchResult {
  const needles = needlesFor(query);
  const builtins = PATTERNS.filter((pattern) => matchesNeedles(pattern, needles));
  const user = userTemplates.filter((template) => matchesNeedles(template, needles));
  const counts = {
    all: builtins.length + user.length,
    "user-templates": user.length,
  } as Record<PatternFilter, number>;
  for (const category of PATTERN_CATEGORIES) {
    counts[category] = builtins.filter((pattern) => pattern.category === category).length;
  }
  return { builtins, userTemplates: user, counts };
}

/** What a filter chip shows, in display order: built-ins first, then saved templates. */
export function patternsForFilter(
  result: PatternSearchResult,
  filter: PatternFilter,
): { builtins: PatternTemplate[]; userTemplates: UserTemplate[] } {
  if (filter === "all") return { builtins: result.builtins, userTemplates: result.userTemplates };
  if (filter === "user-templates") return { builtins: [], userTemplates: result.userTemplates };
  return {
    builtins: result.builtins.filter((pattern) => pattern.category === filter),
    userTemplates: [],
  };
}
