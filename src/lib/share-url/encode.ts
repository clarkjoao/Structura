/**
 * Diagram share-url encoding: compresses a diagram into the URL hash for sharing.
 */
import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";
import type { ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import { getAppBaseUrl, currentHashParams } from "./utils";

export interface ShareUrlResult {
  url: string;
  compressedLength: number;
  originalLength: number;
  compressionRatio: number;
  isSafeForAllEnvs: boolean;
}

const WARN_THRESHOLD = 8_000;

/**
 * The payload key the names travel under, beside the diagram's own fields.
 *
 * Not part of `Diagram`: the diagram does not own its services' or linked
 * diagrams' names, the workspace does. The decoder takes it back off before
 * anything reaches the store (`splitSharedPayload`).
 */
export const READER_CATALOG_KEY = "readerCatalog";

function withCatalog<T extends object>(diagram: T, catalog?: ReaderCatalog): T {
  if (!catalog) return diagram;
  const empty =
    Object.keys(catalog.services).length === 0 && Object.keys(catalog.diagrams).length === 0;
  return empty ? diagram : { ...diagram, [READER_CATALOG_KEY]: catalog };
}

export function encodeDiagramPayload(diagram: Diagram, catalog?: ReaderCatalog): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(withCatalog(diagram, catalog)));
}

/**
 * What a link says beyond the diagram itself.
 *
 * The script an author wants read is not part of the diagram — it is part of
 * the invitation — so it travels as its own parameter rather than inside the
 * compressed payload, the same reasoning that keeps `activeVersionId` out of it.
 * A link can then be pointed at another script by editing a few characters,
 * and the parameter can be checked against the payload instead of trusted.
 */
export interface ShareOptions {
  flowId?: string | null;
  /** The names the diagram shows but does not hold — see `ReaderCatalog`. */
  catalog?: ReaderCatalog;
}

function flowParam(flowId?: string | null): string {
  return flowId ? `&flow=${encodeURIComponent(flowId)}` : "";
}

/** The script a link names, from either kind of link. */
export function getFlowParamFromUrl(): string | null {
  return currentHashParams().get("flow");
}

/**
 * The diagram as a reader should receive it.
 *
 * `activeVersionId` stays: a link draws the scene its author had open, the
 * picture they were looking at when they copied it — the same one the editor
 * draws. `hidden: false` is the default, and dropping it only shortens the link.
 */
function stripForShare(diagram: Diagram): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(diagram, (key: string, value: unknown) => {
      if (key === "hidden" && value === false) return undefined;
      return value;
    }),
  ) as Record<string, unknown>;
}

export function generateShareUrl(diagram: Diagram, options: ShareOptions = {}): ShareUrlResult {
  const stripped = withCatalog(stripForShare(diagram), options.catalog);
  const json = JSON.stringify(stripped);
  const encoded = encodeURIComponent(LZString.compressToEncodedURIComponent(json));
  const url = `${getAppBaseUrl()}#share=${encoded}${flowParam(options.flowId)}`;

  return {
    url,
    compressedLength: url.length,
    originalLength: json.length,
    compressionRatio: Math.max(0, 1 - encoded.length / Math.max(json.length, 1)),
    isSafeForAllEnvs: url.length < WARN_THRESHOLD,
  };
}
