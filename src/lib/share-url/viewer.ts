/**
 * Viewer URL helpers: embed a diagram in the URL for the standalone viewer page.
 */
import type { Diagram } from "@/features/diagram";
import type { ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import { encodeDiagramPayload } from "./encode";
import { decodeDiagramPayloadWithCatalog, type SharedPayload } from "./decode";
import { getAppBaseUrl } from "./utils";

export function getViewerPostMessageUrl(): string {
  return `${getAppBaseUrl()}/viewer`;
}

export function generateViewerUrl(
  diagram: Diagram,
  options: { flowId?: string | null; catalog?: ReaderCatalog } = {},
): string {
  const encoded = encodeDiagramPayload(diagram, options.catalog);
  const flowParam = options.flowId ? `&flow=${encodeURIComponent(options.flowId)}` : "";
  return `${getAppBaseUrl()}/viewer#data=${encoded}${flowParam}`;
}

export function getViewerDataFromHash(): Diagram | null {
  return getViewerPayloadFromHash()?.diagram ?? null;
}

/** The `#data=` payload: the diagram, and the names it carried beside it. */
export function getViewerPayloadFromHash(): SharedPayload | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const encoded = params.get("data");
  if (!encoded) return null;
  try {
    return decodeDiagramPayloadWithCatalog(encoded);
  } catch {
    return null;
  }
}
