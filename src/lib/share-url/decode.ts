/**
 * Diagram share-url decoding: parses a shared diagram from the URL hash.
 */
import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";
import { currentHashParams } from "./utils";
import { logger } from "@/lib/core/logger";

export function decodeDiagramPayload(encoded: string): Diagram {
  const normalized = decodeURIComponent(encoded).replace(/ /g, "+");
  const json = LZString.decompressFromEncodedURIComponent(normalized);
  if (json) {
    return JSON.parse(json) as Diagram;
  }
  throw new Error("Failed to decompress diagram payload");
}

export function getShareParamFromUrl(): string | null {
  return currentHashParams().get("share");
}

export function decodeShareParam(shareParam: string): Diagram | null {
  try {
    const normalized = decodeURIComponent(shareParam).replace(/ /g, "+");
    const json = LZString.decompressFromEncodedURIComponent(normalized);
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
    logger.warn("[share-url]", "Failed to parse URL:", err);
  }

  try {
    // Decode base64 to UTF-8 without the deprecated escape() polyfill.
    const binary = atob(shareParam);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed?.id || !parsed?.snapshot) return null;
    return parsed as Diagram;
  } catch {
    return null;
  }
}
