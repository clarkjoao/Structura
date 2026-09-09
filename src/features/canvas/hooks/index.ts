/**
 * Canvas hooks barrel — commonly used hooks.
 *
 * Keyboard shortcuts are exported from keyboard/helpers.ts directly.
 * Most other hooks are imported by absolute path within the canvas feature.
 */
export { KEY, keyIs, keyIsEnterOrSpace, keyIsOneOf, keyMatchesLetter } from "./keyboard/helpers";
