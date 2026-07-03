import type { LocalizedText } from "./plugin.types";

/**
 * Resolve plugin-provided display text against the active locale. Plugins cannot add
 * keys to the app's i18n catalogs, so they carry their own translations; plain strings
 * render as-is under any locale (RFC D4.4).
 */
export function resolveLocalizedText(text: LocalizedText, locale: string): string {
  if (typeof text === "string") return text;
  const exact = text[locale as keyof typeof text];
  if (typeof exact === "string") return exact;
  return text.en ?? text["pt-BR"] ?? "";
}
