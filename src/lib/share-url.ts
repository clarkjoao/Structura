import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";

export interface ShareUrlResult {
  url: string;
  compressedLength: number;
  originalLength: number;
  compressionRatio: number;
  isSafeForAllEnvs: boolean;
}

const WARN_THRESHOLD = 8_000;

function stripForShare(diagram: Diagram): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(diagram, (key: string, value: unknown) => {
      if (key === "iconLibrary") return undefined;
      if (key === "hidden" && value === false) return undefined;
      return value;
    }),
  ) as Record<string, unknown>;
}

function encodeLegacyBase64(data: string): string {
  return btoa(unescape(encodeURIComponent(data)));
}

function buildShareUrlResult(
  encodedPayload: string,
  originalJsonLength: number,
): ShareUrlResult {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const base = `${window.location.origin}${basePath}`;
  const url = `${base}#share=${encodedPayload}`;

  return {
    url,
    compressedLength: url.length,
    originalLength: originalJsonLength,
    compressionRatio: Math.max(
      0,
      1 - encodedPayload.length / Math.max(originalJsonLength, 1),
    ),
    isSafeForAllEnvs: url.length < WARN_THRESHOLD,
  };
}

export function generateShareUrl(diagram: Diagram): ShareUrlResult {
  const strippedDiagram = stripForShare(diagram);
  const json = JSON.stringify(strippedDiagram);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return buildShareUrlResult(compressed, json.length);
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
  } catch {
    // Fall through to legacy base64.
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

export function generateEmbedShareUrl(diagram: Diagram): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const base = `${window.location.origin}${basePath}`;
  const encodedPayload = generateShareUrl(diagram).url.split("#share=")[1] ?? "";
  return `${base}?embed=true#share=${encodedPayload}`;
}
