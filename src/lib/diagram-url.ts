import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";

export function encodeDiagramPayload(diagram: Diagram): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(diagram));
}

export function decodeDiagramPayload(encoded: string): Diagram {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (json) {
    return JSON.parse(json) as Diagram;
  }
  throw new Error("Failed to decompress diagram payload");
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export function getAppUrl(): string {
  const pathnameWithoutTrailingSlash = window.location.pathname.replace(/\/$/, "");
  return `${window.location.origin}${pathnameWithoutTrailingSlash}`;
}

export interface ShareUrlResult {
  url: string;
  compressedLength: number;
  originalLength: number;
  compressionRatio: number;
  isSafeForAllEnvs: boolean;
}

const WARN_THRESHOLD = 8_000;

/**
 * What a link says beyond the diagram itself.
 *
 * The script an author wants read is not part of the diagram — it is part of
 * the invitation — so it travels as its own parameter rather than inside the
 * compressed payload, the same reasoning that keeps `activeSceneId` out of it.
 * A link can then be pointed at another script by editing a few characters,
 * and the parameter can be checked against the payload instead of trusted.
 */
export interface ShareOptions {
  flowId?: string | null;
}

function flowParam(flowId?: string | null): string {
  return flowId ? `&flow=${encodeURIComponent(flowId)}` : "";
}

/** The script a link names, from either kind of link. */
export function getFlowParamFromUrl(): string | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash).get("flow");
}

/**
 * The diagram as a reader should receive it.
 *
 * `activeSceneId` is which scene the author happened to have open, not part of
 * the diagram: carried into a link it dropped the reader inside that scene,
 * missing the nodes it hides, with nothing saying so and no way out. A link
 * opens on the base.
 *
 * The viewer resolves the base whatever arrives, so this is not the only guard
 * — links shared before this change still carry the field. Dropping it here
 * keeps the payload to what the reader is meant to see.
 */
function stripForShare(diagram: Diagram): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(diagram, (key: string, value: unknown) => {
      if (key === "iconLibrary") return undefined;
      if (key === "activeSceneId") return undefined;
      if (key === "hidden" && value === false) return undefined;
      return value;
    }),
  ) as Record<string, unknown>;
}

export function generateShareUrl(diagram: Diagram, options: ShareOptions = {}): ShareUrlResult {
  const stripped = stripForShare(diagram);
  const json = JSON.stringify(stripped);
  const encoded = LZString.compressToEncodedURIComponent(json);
  const base = `${window.location.origin}${getBasePath()}`;
  const url = `${base}#share=${encoded}${flowParam(options.flowId)}`;

  return {
    url,
    compressedLength: url.length,
    originalLength: json.length,
    compressionRatio: Math.max(0, 1 - encoded.length / Math.max(json.length, 1)),
    isSafeForAllEnvs: url.length < WARN_THRESHOLD,
  };
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
    console.warn("[diagram-url] Failed to parse URL:", err);
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

export function getViewerPostMessageUrl(): string {
  return `${window.location.origin}${getBasePath()}/viewer`;
}

export function generateViewerUrl(diagram: Diagram, options: ShareOptions = {}): string {
  const encoded = encodeDiagramPayload(diagram);
  return `${window.location.origin}${getBasePath()}/viewer#data=${encoded}${flowParam(options.flowId)}`;
}

export function getViewerDataFromHash(): Diagram | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const encoded = params.get("data");
  if (!encoded) return null;
  try {
    return decodeDiagramPayload(encoded);
  } catch {
    return null;
  }
}
