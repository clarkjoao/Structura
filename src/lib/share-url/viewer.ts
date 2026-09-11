/**
 * Viewer URL helpers: embed a diagram in the URL for the standalone viewer page.
 */
import type { Diagram } from "@/features/diagram";
import { encodeDiagramPayload } from "./encode";
import { decodeDiagramPayload } from "./decode";
import { getBasePath } from "./utils";
import { logger } from "../core/logger";

export function getViewerPostMessageUrl(): string {
  return `${window.location.origin}${getBasePath()}/viewer`;
}

export function generateViewerUrl(
  diagram: Diagram,
  options: { flowId?: string | null } = {},
): string {
  const encoded = encodeURIComponent(encodeDiagramPayload(diagram));
  const flowParam = options.flowId ? `&flow=${encodeURIComponent(options.flowId)}` : "";
  return `${window.location.origin}${getBasePath()}/viewer#data=${encoded}${flowParam}`;
}

export function getViewerDataFromHash(): Diagram | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const encoded = params.get("data");
  if (!encoded) return null;
  try {
    return decodeDiagramPayload(encoded);
  } catch (e){
    logger.error("Failed to decode diagram payload from URL hash", e);
    return null;
  }
}
