import type { Diagram } from "@/features/diagram";

export type EmbedUrlMethod = "base64" | "json" | "postmessage";

function encodeUtf8ToBase64(value: string): string {
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
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

  const encodedDiagram = encodeUtf8ToBase64(JSON.stringify(diagram));
  return `${baseUrl}?embed=true&data=${encodeURIComponent(encodedDiagram)}`;
}

export function generateEmbedSrcUrl(sourceUrl: string): string {
  const baseUrl = getCurrentBaseUrl();
  const normalizedSourceUrl = sourceUrl.trim();
  if (!normalizedSourceUrl) return `${baseUrl}?embed=true`;
  return `${baseUrl}?embed=true&src=${encodeURIComponent(normalizedSourceUrl)}`;
}
