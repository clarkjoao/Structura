import type { AccentToken } from "@/features/elements/element.types";

/**
 * Tailwind left-border class for a palette accent token.
 *
 * `{ kind: "token", cssVar: "--gcp-compute" }` → `border-l-gcp-compute`,
 * matching the classes that used to live in per-provider `*_CATEGORY_BORDERS`
 * maps. Neutral accents paint no coloured edge.
 */
export function borderClassForAccent(accent: AccentToken): string {
  if (accent.kind === "neutral") return "";
  if (!accent.cssVar.startsWith("--")) {
    throw new Error(
      `[elements] accent cssVar must be a CSS custom-property name starting with "--"; got "${accent.cssVar}"`,
    );
  }
  return `border-l-${accent.cssVar.slice(2)}`;
}
