/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host export core (src/lib/export-core), synced via
 * `npm run sync-shared`. It is the single source of truth for draw.io
 * generation shared by the app and this plugin; edit the host files and re-sync.
 */

import type { StyleOption } from "./types";

export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildStyle(baseStyle: string, options: StyleOption): string {
  const normalizedBaseStyle = baseStyle.endsWith(";") ? baseStyle : `${baseStyle};`;

  const stylePairs = Object.entries(options)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value};`)
    .join("");

  return `${normalizedBaseStyle}${stylePairs}`;
}

export function applyTemplate(template: string, placeholders: Record<string, string>): string {
  return template.replace(/%(\w+)%/g, (_, key) => placeholders[key] || "");
}
