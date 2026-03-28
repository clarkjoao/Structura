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

/**
 * Reads mxGraphModel XML from the system clipboard.
 * Returns null if clipboard does not contain draw.io content or permission denied.
 */
export async function readDrawioFromClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        // Prefer text/plain — draw.io native copy writes raw XML there
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const text = await blob.text();
          if (text.includes("<mxGraphModel") || text.includes("<mxfile")) {
            return text;
          }
        }
        // Fallback: text/html — writeDrawioToClipboard encodes XML inside HTML
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          const html = await blob.text();
          const match = html.match(/&lt;mxGraphModel[\s\S]*?&lt;\/mxGraphModel&gt;/);
          if (match) {
            return match[0]
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"');
          }
        }
      }
    }
    // Fallback: readText only
    const text = await navigator.clipboard.readText();
    if (text.includes("<mxGraphModel") || text.includes("<mxfile")) {
      return text;
    }
  } catch {
    // Permission denied or API unavailable — fail silently
  }
  return null;
}
