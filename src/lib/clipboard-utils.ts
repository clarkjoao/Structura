import { extractMxGraphModelXml } from "@/lib/export-service";

function escapeForHtmlClipboard(xml: string): string {
  return xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  } catch {}

  try {
    await navigator.clipboard.writeText(graphModelXml);
  } catch {
    console.warn("[Clipboard] Could not write to system clipboard");
  }
}

export async function readDrawioFromClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const text = await blob.text();
          if (text.includes("<mxGraphModel") || text.includes("<mxfile")) {
            return text;
          }
        }

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

    const text = await navigator.clipboard.readText();
    if (text.includes("<mxGraphModel") || text.includes("<mxfile")) {
      return text;
    }
  } catch {}
  return null;
}

export async function readSvgFromClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("image/svg+xml")) {
          const blob = await item.getType("image/svg+xml");
          return await blob.text();
        }

        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const text = await blob.text();
          const trimmed = text.trim();

          if (trimmed.includes("<mxGraphModel") || trimmed.includes("<mxfile")) {
            continue;
          }
          if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
            return trimmed;
          }
        }
      }
    }
  } catch {}
  return null;
}
