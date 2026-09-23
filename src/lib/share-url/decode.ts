/**
 * Diagram share-url decoding: parses a shared diagram from the URL hash.
 */
import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";
import { readerCatalogFrom, type ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import { READER_CATALOG_KEY } from "./encode";
import { currentHashParams } from "./utils";
import { logger } from "@/lib/core/logger";

/** A diagram as a link hands it over, with the names it shows but does not hold. */
export interface SharedPayload {
  diagram: Diagram;
  catalog: ReaderCatalog;
}

/**
 * Takes the names back off a decoded payload.
 *
 * The diagram that comes out is a plain `Diagram` — nothing that reaches the
 * store (an import) carries the catalog. A payload written before the catalog
 * existed, or by someone else, reads as an empty one.
 */
export function splitSharedPayload(parsed: Diagram): SharedPayload {
  if (!(READER_CATALOG_KEY in parsed)) {
    return { diagram: parsed, catalog: readerCatalogFrom(undefined) };
  }
  const { [READER_CATALOG_KEY]: raw, ...diagram } = parsed as Diagram & Record<string, unknown>;
  return { diagram: diagram as Diagram, catalog: readerCatalogFrom(raw) };
}

export function decodeDiagramPayloadWithCatalog(encoded: string): SharedPayload {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (json) {
    return splitSharedPayload(JSON.parse(json) as Diagram);
  }
  throw new Error("Failed to decompress diagram payload");
}

export function decodeDiagramPayload(encoded: string): Diagram {
  return decodeDiagramPayloadWithCatalog(encoded).diagram;
}

export function getShareParamFromUrl(): string | null {
  return currentHashParams().get("share");
}

export function decodeShareParam(shareParam: string): Diagram | null {
  return decodeSharePayload(shareParam)?.diagram ?? null;
}

export function decodeSharePayload(shareParam: string): SharedPayload | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(shareParam);
    if (json) {
      const parsed = JSON.parse(json);
      if (!parsed?.id || !parsed?.snapshot) return null;
      return splitSharedPayload({
        ...parsed,
        snapshot: {
          iconLibrary: {},
          ...parsed.snapshot,
        },
      } as Diagram);
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
    return splitSharedPayload(parsed as Diagram);
  } catch {
    return null;
  }
}
