/**
 * Viewer URL helpers: embed a diagram in the URL for the standalone viewer page.
 */
import type { Diagram } from "@/features/diagram";
import { encodeDiagramPayload } from "./encode";
import { decodeDiagramPayload } from "./decode";
import { getAppBaseUrl } from "./utils";

export function getViewerPostMessageUrl(): string {
  return `${getAppBaseUrl()}/viewer`;
}

export function generateViewerUrl(
  diagram: Diagram,
  options: { flowId?: string | null } = {},
): string {
  const encoded = encodeDiagramPayload(diagram);
  const flowParam = options.flowId ? `&flow=${encodeURIComponent(options.flowId)}` : "";
  return `${getAppBaseUrl()}/viewer#data=${encoded}${flowParam}`;
}

export function getViewerDataFromHash(): Diagram | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const encoded = params.get("data");
  if (!encoded) return null;
  try {
    return decodeDiagramPayload(encoded);
  } catch {
    return null;
  }
}
