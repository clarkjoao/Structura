import { extractMxGraphModelXml } from "@/lib/export-service";
import type { ClipboardEntry } from "@/features/diagram/store/store.types";

// Chrome's "web custom formats" for the Async Clipboard API (Chromium 104+) store
// data under a MIME type no other app will ever request. This is deliberately
// NOT embedded in the text/html payload below: real draw.io's paste importer
// parses that exact html shape to recognize a graph to import, and an earlier
// version of this file that hid an extra marker div inside it broke that
// recognition — draw.io fell back to importing the raw escaped XML as literal
// text shapes instead of real diagram cells. Keeping text/plain and text/html
// byte-for-byte what real draw.io itself would write avoids that entirely.
const STRUCTURA_CUSTOM_TYPE = "application/x-structura-clipboard+json";
const STRUCTURA_CUSTOM_FORMAT = `web ${STRUCTURA_CUSTOM_TYPE}`;

function escapeForHtmlClipboard(xml: string): string {
  return xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function supportsStructuraCustomFormat(): boolean {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof ClipboardItem.supports === "function" &&
    ClipboardItem.supports(STRUCTURA_CUSTOM_FORMAT)
  );
}

export async function writeDrawioToClipboard(
  fullDrawioXml: string,
  structuraClipboardEntry?: ClipboardEntry,
): Promise<void> {
  const graphModelXml = extractMxGraphModelXml(fullDrawioXml);
  const html =
    `<meta charset="utf-8">` +
    `<div data-type="text/plain" style="white-space:pre-wrap;font-family:monospace">` +
    escapeForHtmlClipboard(graphModelXml) +
    `</div>`;

  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const items: Record<string, Blob> = {
        "text/plain": new Blob([graphModelXml], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      };
      if (structuraClipboardEntry && supportsStructuraCustomFormat()) {
        items[STRUCTURA_CUSTOM_FORMAT] = new Blob([JSON.stringify(structuraClipboardEntry)], {
          type: STRUCTURA_CUSTOM_TYPE,
        });
      }
      await navigator.clipboard.write([new ClipboardItem(items)]);
      return;
    }
  } catch (err) {
    console.warn("[Clipboard] Failed to copy draw.io XML:", err);
  }

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
  } catch (err) {
    console.warn("[Clipboard] Failed to read draw.io from clipboard:", err);
  }
  return null;
}

/**
 * Reads back the full-fidelity `ClipboardEntry` written by
 * `writeDrawioToClipboard` under the Structura custom clipboard format, if
 * present. Returns null whenever the OS clipboard wasn't written by this app,
 * the writing browser didn't support custom formats, or the payload can't be
 * parsed (corrupted, or written by an older Structura build) — callers should
 * fall back to the lossy draw.io XML import in that case.
 */
export async function readStructuraClipboard(): Promise<ClipboardEntry | null> {
  try {
    if (!navigator.clipboard?.read) return null;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (!item.types.includes(STRUCTURA_CUSTOM_FORMAT)) continue;
      const blob = await item.getType(STRUCTURA_CUSTOM_FORMAT);
      const text = await blob.text();
      return JSON.parse(text) as ClipboardEntry;
    }
  } catch (err) {
    console.warn("[Clipboard] Failed to read Structura clipboard payload:", err);
  }
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
  } catch (err) {
    console.warn("[Clipboard] Failed to read SVG from clipboard:", err);
  }
  return null;
}
