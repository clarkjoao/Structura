/**
 * Diagram share-url decoding: parses a shared diagram from the URL hash.
 */
import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";
import { readerCatalogFrom, type ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import { READER_CATALOG_KEY } from "./encode";
import { currentHashParams } from "./utils";
import { sanitizeDiagramSvg } from "@/lib/export-service/sanitize-diagram-svg";
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
    return { diagram: sanitizeDiagramSvg(parsed), catalog: readerCatalogFrom(undefined) };
  }
  const { [READER_CATALOG_KEY]: raw, ...diagram } = parsed as Diagram & Record<string, unknown>;
  return { diagram: sanitizeDiagramSvg(diagram as Diagram), catalog: readerCatalogFrom(raw) };
}

/**
 * Largest share payload accepted, as the encoded URL parameter and as the decoded JSON, in
 * characters. Real links are tens of KB (the encoder warns at 8000 chars); the cap only stops a
 * crafted link from exhausting memory in the decompressor or the parser.
 */
export const MAX_SHARE_PAYLOAD_CHARS = 5 * 1024 * 1024;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A payload may omit the sections it has nothing in. */
function withDefaults(snapshot: Diagram["snapshot"]): Diagram["snapshot"] {
  return { ...snapshot, iconLibrary: snapshot.iconLibrary ?? {}, flows: snapshot.flows ?? {} };
}

/** Whether a decoded payload has the shape of a diagram the viewer can render. */
function isSharedDiagramShape(value: unknown): value is Diagram {
  if (!isPlainRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  const snapshot = value.snapshot;
  if (!isPlainRecord(snapshot)) return false;
  if (!isPlainRecord(snapshot.components) || !isPlainRecord(snapshot.connections)) return false;
  if (snapshot.flows !== undefined && !isPlainRecord(snapshot.flows)) return false;
  if (snapshot.iconLibrary !== undefined && !isPlainRecord(snapshot.iconLibrary)) return false;
  return true;
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
  if (shareParam.length > MAX_SHARE_PAYLOAD_CHARS) {
    logger.warn("[share-url]", "Share payload exceeds the size limit");
    return null;
  }

  try {
    const json = LZString.decompressFromEncodedURIComponent(shareParam);
    if (json) {
      if (json.length > MAX_SHARE_PAYLOAD_CHARS) {
        logger.warn("[share-url]", "Decoded share payload exceeds the size limit");
        return null;
      }
      const parsed: unknown = JSON.parse(json);
      if (!isSharedDiagramShape(parsed)) {
        logger.warn("[share-url]", "Share payload is not a diagram");
        return null;
      }
      return splitSharedPayload({
        ...parsed,
        snapshot: withDefaults(parsed.snapshot),
      });
    }
  } catch (err) {
    logger.warn("[share-url]", "Failed to parse URL:", err);
  }

  try {
    // Decode base64 to UTF-8 without the deprecated escape() polyfill.
    const binary = atob(shareParam);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    if (json.length > MAX_SHARE_PAYLOAD_CHARS) return null;
    const parsed: unknown = JSON.parse(json);
    if (!isSharedDiagramShape(parsed)) return null;
    return splitSharedPayload({
      ...parsed,
      snapshot: withDefaults(parsed.snapshot),
    });
  } catch {
    return null;
  }
}
