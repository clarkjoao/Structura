/**
 * Diagram share-url decoding: parses a shared diagram from the URL hash.
 */
import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";

export function decodeDiagramPayload(encoded: string): Diagram {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (json) {
    return JSON.parse(json) as Diagram;
  }
  throw new Error("Failed to decompress diagram payload");
}

export function getShareParamFromUrl(): string | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get("share");
}

export function decodeShareParam(shareParam: string): Diagram | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(shareParam);
    if (json) {
      const parsed = JSON.parse(json);
      if (!parsed?.id || !parsed?.snapshot) return null;
      return {
        ...parsed,
        snapshot: {
          iconLibrary: {},
          ...parsed.snapshot,
        },
      } as Diagram;
    }
  } catch (err) {
    console.warn("[share-url] Failed to parse URL:", err);
  }

  try {
    const json = decodeURIComponent(escape(atob(shareParam)));
    const parsed = JSON.parse(json);
    if (!parsed?.id || !parsed?.snapshot) return null;
    return parsed as Diagram;
  } catch {
    return null;
  }
}
