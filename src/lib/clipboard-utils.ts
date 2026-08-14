import { extractMxGraphModelXml } from "@/lib/export-service";
import type { ClipboardEntry } from "@/features/diagram/store/store.types";

const STRUCTURA_CLIPBOARD_ATTR = "data-structura-clipboard";

function escapeForHtmlClipboard(xml: string): string {
  return xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Encodes a UTF-8 string to base64. `btoa` only accepts Latin1, so component
 * names/descriptions with non-ASCII characters (accents, emoji) need this
 * UTF-8-safe wrapper instead of a bare `btoa` call.
 */
function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Builds the hidden marker embedded in the `text/html` clipboard payload
 * alongside the draw.io XML. It carries a full-fidelity, base64-encoded JSON
 * copy of the internal clipboard entry (styles, AWS type/icon, custom colors)
 * so paste in a *different browser tab/window* — which can't share the
 * in-memory Zustand clipboard — can still be lossless. Real external apps
 * (actual draw.io, other tools) simply ignore this unknown div; only
 * Structura's own paste handler looks for it.
 */
function buildStructuraClipboardMarker(entry: ClipboardEntry): string {
  const encoded = encodeBase64Utf8(JSON.stringify(entry));
  return `<div ${STRUCTURA_CLIPBOARD_ATTR}="1" style="display:none">${encoded}</div>`;
}

export async function writeDrawioToClipboard(
  fullDrawioXml: string,
  structuraClipboardEntry?: ClipboardEntry,
): Promise<void> {
  const graphModelXml = extractMxGraphModelXml(fullDrawioXml);
  const structuraMarker = structuraClipboardEntry
    ? buildStructuraClipboardMarker(structuraClipboardEntry)
    : "";
  const html =
    `<meta charset="utf-8">` +
    `<div data-type="text/plain" style="white-space:pre-wrap;font-family:monospace">` +
    escapeForHtmlClipboard(graphModelXml) +
    `</div>` +
    structuraMarker;

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
 * Reads back the full-fidelity `ClipboardEntry` embedded by
 * `writeDrawioToClipboard`, if present. Returns null whenever the OS
 * clipboard wasn't written by this app (no marker div), or the marker can't
 * be parsed (corrupted, or written by an older Structura build) — callers
 * should fall back to the lossy draw.io XML import in that case.
 */
export async function readStructuraClipboard(): Promise<ClipboardEntry | null> {
  try {
    if (!navigator.clipboard?.read) return null;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (!item.types.includes("text/html")) continue;
      const blob = await item.getType("text/html");
      const html = await blob.text();
      const match = html.match(new RegExp(`${STRUCTURA_CLIPBOARD_ATTR}="1"[^>]*>([^<]*)</div>`));
      if (!match) continue;
      const decoded = decodeBase64Utf8(match[1]);
      return JSON.parse(decoded) as ClipboardEntry;
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
