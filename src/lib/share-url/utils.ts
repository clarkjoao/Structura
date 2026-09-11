/**
 * Share-url internals: URL helpers shared between encode, decode, and viewer.
 */

/** Returns the app base path without a trailing slash. */
export function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

/**
 * Origin + Vite base path, independent of the current route.
 *
 * @example
 * getAppBaseUrl(); // "https://app.example/structura"
 */
export function getAppBaseUrl(): string {
  return `${window.location.origin}${getBasePath()}`;
}

/** Returns the current origin + pathname without trailing slash. */
export function getAppUrl(): string {
  const pathnameWithoutTrailingSlash = window.location.pathname.replace(/\/$/, "");
  return `${window.location.origin}${pathnameWithoutTrailingSlash}`;
}

/**
 * Strips the leading `#` from a hash string so it can be parsed as URLSearchParams.
 * Returns the string unchanged if it doesn't start with `#`.
 */
export function stripHashPrefix(hash: string): string {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

/** Parses the current `window.location.hash` into a URLSearchParams object. */
export function currentHashParams(): URLSearchParams {
  return new URLSearchParams(stripHashPrefix(window.location.hash));
}
