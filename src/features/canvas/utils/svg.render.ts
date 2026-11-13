import { sanitizeSvg } from "./svg.sanitizer";

/** Bounded so a long session with many distinct SVGs cannot grow the cache without limit. */
const MAX_CACHED = 500;
const cache = new Map<string, string>();

/**
 * Markup that is safe to hand to `dangerouslySetInnerHTML`.
 *
 * `svgContent` reaches the store from files, share links, collaboration patches and plugins, not
 * only from the upload paths that already sanitize, so every render goes through the sanitizer.
 * Results are memoized per input string, so re-renders cost a map lookup. Content that is not a
 * valid SVG renders as nothing.
 */
export function safeSvgMarkup(svgContent: string | null | undefined): string {
  // A collaboration patch or plugin can leave the field unset despite the type.
  if (typeof svgContent !== "string") return "";
  const hit = cache.get(svgContent);
  if (hit !== undefined) return hit;
  const clean = sanitizeSvg(svgContent) ?? "";
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(svgContent, clean);
  return clean;
}
