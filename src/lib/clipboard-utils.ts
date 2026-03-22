import { extractMxGraphModelXml } from "@/lib/export-service";

/** HTML-escape for embedding XML inside a clipboard HTML fragment (draw.io reads text/html). */
function escapeForHtmlClipboard(xml: string): string {
  return xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Writes draw.io–compatible clipboard data so diagrams.net imports shapes instead of
 * pasting the XML as a text box. Uses the {@code mxGraphModel} fragment only (same idea
 * as draw.io's native copy) plus explicit {@code text/html} so the browser does not
 * synthesize a broken HTML wrapper that steals paste handling.
 */
export async function writeDrawioToClipboard(fullDrawioXml: string): Promise<void> {
  const graphModelXml = extractMxGraphModelXml(fullDrawioXml);
  const html =
    `<meta charset="utf-8">` +
    `<div data-type="text/plain" style="white-space:pre-wrap;font-family:monospace">` +
    escapeForHtmlClipboard(graphModelXml) +
    `</div>`;

  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([graphModelXml], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    }
  } catch {
    // fall through
  }

  try {
    await navigator.clipboard.writeText(graphModelXml);
  } catch {
    console.warn("[Clipboard] Could not write to system clipboard");
  }
}
