import type { StyleOption } from "./types";

export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildStyle(baseStyle: string, options: StyleOption): string {
  const stylePairs = Object.entries(options)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`);

  return [baseStyle, ...stylePairs].filter(Boolean).join(";");
}

export function applyTemplate(
  template: string,
  placeholders: Record<string, string>,
): string {
  return template.replace(/%(\w+)%/g, (_, key) => placeholders[key] || "");
}
