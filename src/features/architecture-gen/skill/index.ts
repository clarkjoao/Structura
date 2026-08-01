/**
 * The architecture generation skill.
 *
 * Kept as Markdown next to this file so it reads and reviews as prose rather than as a string
 * literal, and imported with Vite's `?raw` so it ships in the bundle with no fetch at runtime.
 */

import skillMarkdown from "./skill-architecture.md?raw";

/** Full skill text, injected into the system prompt. */
export const ARCHITECTURE_SKILL = skillMarkdown.trim();

/**
 * Guards against the skill silently dropping out of the bundle: an empty or truncated import
 * would leave the model with tools and no instructions, which fails as bad diagrams rather
 * than as an error.
 */
export function isSkillLoaded(): boolean {
  return ARCHITECTURE_SKILL.length > 1000;
}
