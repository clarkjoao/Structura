/**
 * Backwards-compatible alias for `@/lib/core`.
 * New code should import directly from the specific module (e.g. `@/lib/core/cn`).
 */
export { cn, type ClassValue } from "./core/cn";
export { KEY, keyIs, keyIsEnterOrSpace, keyIsOneOf, keyMatchesLetter } from "./core/keyboard";
export { formatTimestamp } from "./core/format-timestamp";
