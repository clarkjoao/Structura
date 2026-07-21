import type { StyleOption } from "./types";

/**
 * Escape XML special characters
 */
export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build a draw.io style string from base style and options
 */
export function buildStyle(baseStyle: string, options: StyleOption): string {
  const normalizedBaseStyle = baseStyle.endsWith(";") ? baseStyle : `${baseStyle};`;

  const stylePairs = Object.entries(options)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value};`)
    .join("");

  return `${normalizedBaseStyle}${stylePairs}`;
}

/**
 * Apply placeholders to a template string
 */
export function applyTemplate(template: string, placeholders: Record<string, string>): string {
  return template.replace(/%(\w+)%/g, (_, key) => placeholders[key] || "");
}
