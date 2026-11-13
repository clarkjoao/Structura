/**
 * Who may hand the embedded viewer a diagram (audit D4).
 *
 * Embedding from any site is the feature: a docs page, a wiki, a Docusaurus build
 * all point an iframe at `/viewer` and post the diagram in. So by default the
 * origin is open. What is closed is *who* inside the browser may post: only the
 * window that embeds the viewer. Another frame on the same page, a popup opener or
 * a script holding a reference to the window cannot replace the diagram on show.
 *
 * The payload itself is validated (`assertDiagram`) and its SVG sanitized on the
 * way in, and the viewer writes nothing to the reader's store, so an accepted
 * message can change what this frame draws and nothing else.
 *
 * A self-hosted build that is only embedded by known sites can close the origin
 * too, with `VITE_EMBED_ALLOWED_ORIGINS` (comma-separated, e.g.
 * `https://docs.example.com,https://wiki.example.com`).
 */

export interface EmbedMessageContext {
  /** The viewer's own window. */
  self: Window;
  /** `self.parent`; equal to `self` when the viewer is not in a frame. */
  parent: Window;
  /** Origins allowed to post; empty means any origin. */
  allowedOrigins: readonly string[];
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);
}

export const EMBED_ALLOWED_ORIGINS: readonly string[] = parseAllowedOrigins(
  import.meta.env.VITE_EMBED_ALLOWED_ORIGINS,
);

export function acceptsEmbedMessage(
  event: Pick<MessageEvent, "source" | "origin">,
  { self, parent, allowedOrigins }: EmbedMessageContext,
): boolean {
  // Not embedded: nothing has the standing of an embedding page.
  if (parent === self) return false;
  if (event.source !== parent) return false;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(event.origin);
}
