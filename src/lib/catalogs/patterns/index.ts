import { API_EDGE_PATTERNS } from "./api-edge";
import { DATA_CONSISTENCY_PATTERNS } from "./data-consistency";
import { INTEGRATION_MESSAGING_PATTERNS } from "./integration-messaging";
import { RESILIENCE_PATTERNS } from "./resilience";
import { PATTERN_CATEGORIES, type PatternCategory, type PatternTemplate } from "./types";

export * from "./types";

/** Every built-in pattern, grouped by category in `PATTERN_CATEGORIES` order. */
export const PATTERNS: readonly PatternTemplate[] = [
  ...INTEGRATION_MESSAGING_PATTERNS,
  ...API_EDGE_PATTERNS,
  ...DATA_CONSISTENCY_PATTERNS,
  ...RESILIENCE_PATTERNS,
];

export const PATTERNS_BY_CATEGORY = Object.fromEntries(
  PATTERN_CATEGORIES.map((category) => [
    category,
    PATTERNS.filter((pattern) => pattern.category === category),
  ]),
) as Record<PatternCategory, PatternTemplate[]>;

export function getPattern(id: string): PatternTemplate | undefined {
  return PATTERNS.find((pattern) => pattern.id === id);
}
