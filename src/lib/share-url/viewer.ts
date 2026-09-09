/**
 * Viewer URL helpers: embed a diagram in the URL for the standalone viewer page.
 */
import type { Diagram } from "@/features/diagram";
import { encodeDiagramPayload } from "./encode";
import { decodeDiagramPayload } from "./decode";

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export function getViewerPostMessageUrl(): string {
  return `${window.location.origin}${getBasePath()}/viewer`;
}

export function generateViewerUrl(
  diagram: Diagram,
  options: { flowId?: string | null } = {},
): string {
  const encoded = encodeDiagramPayload(diagram);
  const flowParam = options.flowId ? `&flow=${encodeURIComponent(options.flowId)}` : "";
  return `${window.location.origin}${getBasePath()}/viewer#data=${encoded}${flowParam}`;
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
