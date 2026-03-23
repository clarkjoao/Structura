import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";

export type EmbedUrlMethod = "base64" | "json" | "postmessage";

function encodeUtf8ToBase64(value: string): string {
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function decodeBase64ToUtf8(value: string): string {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a diagram into a URL-safe payload string.
 *
 * Format: `base64url(lz-string(JSON(diagram)))`
 *
 * @param diagram - The diagram to encode.
 * @returns A base64url-encoded, lz-string-compressed payload string.
 */
export function encodeDiagramPayload(diagram: Diagram): string {
  const compressed = LZString.compress(JSON.stringify(diagram));
  return encodeUtf8ToBase64(compressed);
}

/**
 * Decodes a payload string back into a Diagram.
 *
 * Supports both the current format `base64url(lz-string(JSON(diagram)))` and
 * legacy payloads (plain `base64(JSON(diagram))`) for backwards compatibility.
 *
 * @param encoded - The base64url (or legacy base64) encoded payload string.
 * @returns The decoded Diagram.
 */
export function decodeDiagramPayload(encoded: string): Diagram {
  const raw = decodeBase64ToUtf8(encoded);

  // Try lz-string decompression first (current format)
  const decompressed = LZString.decompress(raw);
  if (decompressed) {
    return JSON.parse(decompressed) as Diagram;
  }

  // Fallback: legacy plain base64-encoded JSON (no compression)
  return JSON.parse(raw) as Diagram;
}

function getCurrentBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function getStructuraAppUrl(): string {
  const pathnameWithoutTrailingSlash = window.location.pathname.replace(/\/$/, "");
  return `${window.location.origin}${pathnameWithoutTrailingSlash}`;
}

export function generateEmbedUrl(
  diagram: Diagram | null,
  method: EmbedUrlMethod = "base64",
): string {
  const baseUrl = getCurrentBaseUrl();

  if (method === "postmessage") {
    return `${baseUrl}?embed=true`;
  }

  if (!diagram) {
    return `${baseUrl}?embed=true`;
  }

  if (method === "json") {
    const encodedJson = encodeURIComponent(JSON.stringify(diagram));
    return `${baseUrl}?embed=true&json=${encodedJson}`;
  }

  const encodedDiagram = encodeDiagramPayload(diagram);
  return `${baseUrl}?embed=true&data=${encodedDiagram}`;
}

export function generateEmbedSrcUrl(sourceUrl: string): string {
  const baseUrl = getCurrentBaseUrl();
  const normalizedSourceUrl = sourceUrl.trim();
  if (!normalizedSourceUrl) return `${baseUrl}?embed=true`;
  return `${baseUrl}?embed=true&src=${encodeURIComponent(normalizedSourceUrl)}`;
}

// ---------------------------------------------------------------------------
// SPA routing bypass
//
// Some hosts (S3, GitHub Pages, Netlify without rewrites) only serve "/"
// and return NoSuchKey/404 for any sub-route.
//
// When VITE_EMBED_ROUTING_BYPASS=true, "Abrir no Structura" encodes the
// diagram into /?import=<b64> instead of opening the app root directly.
// The app detects and consumes the payload after mounting via
// `consumeImportPayload` (see src/hooks/useImportPayload.ts).
// ---------------------------------------------------------------------------

export const ROUTING_BYPASS_ENABLED =
  import.meta.env.VITE_EMBED_ROUTING_BYPASS === "true";

const IMPORT_PARAM = "import";
const BYPASS_DELAY_MS = 350;

/**
 * Builds the URL for "Abrir no Structura".
 * - Bypass OFF → app root URL (existing behavior, router handles navigation)
 * - Bypass ON  → `/?import=<base64>` so the CDN always serves index.html
 */
export function buildOpenInStructuraUrl(diagram: Diagram): string {
  const base = getStructuraAppUrl();

  if (!ROUTING_BYPASS_ENABLED) {
    return base;
  }

  const encoded = encodeDiagramPayload(diagram);
  const url = new URL("/", window.location.origin);
  url.searchParams.set(IMPORT_PARAM, encoded);
  return url.toString();
}

/**
 * Call once at app startup (root component / router layout).
 *
 * If `?import=<b64>` is in the URL, waits `delayMs` ms for the app to
 * fully mount, then calls `onDiagram` with the decoded Diagram and
 * cleans the param from history so the user never sees it.
 *
 * Returns a cleanup function (clears the timeout if component unmounts).
 * Safe no-op when bypass is disabled or no param is present.
 */
export function consumeImportPayload(
  onDiagram: (diagram: Diagram) => void,
  delayMs = BYPASS_DELAY_MS,
): () => void {
  if (!ROUTING_BYPASS_ENABLED) return () => {};

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(IMPORT_PARAM);
  if (!encoded) return () => {};

  // Clean the URL immediately — before the timeout fires
  params.delete(IMPORT_PARAM);
  const cleanUrl =
    params.size > 0
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
  window.history.replaceState(null, "", cleanUrl);

  const timerId = window.setTimeout(() => {
    try {
      const diagram = decodeDiagramPayload(encoded);
      onDiagram(diagram);
    } catch {
      console.error("[Structura] Failed to parse ?import payload");
    }
  }, delayMs);

  return () => window.clearTimeout(timerId);
}