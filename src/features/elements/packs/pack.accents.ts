import type { AccentToken } from "../element.types";
import { packTypeId, toHslTriplet, type ElementPack, type PackCategory } from "./pack.schema";

/**
 * Category accents as CSS custom properties, injected at registration.
 *
 * The hand-written families declared `--aws-compute` in `index.css`, mapped it in
 * `tailwind.config.ts` and listed `border-l-aws-compute` in a map only so Tailwind's content
 * scan would emit it. A pack's colours are data Tailwind never sees, so the loader writes both
 * the token (light and `.dark`) and the `border-l-*` class `borderClassForAccent` derives.
 */

/** `--aws-compute` for verbatim ids (unchanged), `--pack-<packId>-<id>` for namespaced ones. */
function accentCssVar(pack: ElementPack, category: PackCategory): string {
  const typeId = packTypeId(pack, category.id);
  return pack.typeIds === "verbatim" ? `--${typeId}` : `--pack-${pack.id}-${category.id}`;
}

export function accentToken(pack: ElementPack, category: PackCategory): AccentToken {
  return { kind: "token", cssVar: accentCssVar(pack, category) };
}

/** The stylesheet text for a pack's accents. Pure, so it is testable without a DOM. */
export function packAccentCss(pack: ElementPack): string {
  if (pack.categories.length === 0) return "";
  const light: string[] = [];
  const dark: string[] = [];
  const classes: string[] = [];
  for (const category of pack.categories) {
    const cssVar = accentCssVar(pack, category);
    light.push(`  ${cssVar}: ${toHslTriplet(category.accent.light)};`);
    dark.push(`  ${cssVar}: ${toHslTriplet(category.accent.dark ?? category.accent.light)};`);
    classes.push(
      `.border-l-${cssVar.slice(2)} { border-left-color: hsl(var(${cssVar})); }`,
      `.text-${cssVar.slice(2)} { color: hsl(var(${cssVar})); }`,
    );
  }
  return [`:root {`, ...light, `}`, `.dark {`, ...dark, `}`, ...classes, ""].join("\n");
}

const ATTRIBUTE = "data-element-pack";

/** Injects (or replaces) the pack's stylesheet; a no-op where there is no DOM. */
export function injectPackAccents(pack: ElementPack): void {
  if (typeof document === "undefined") return;
  const css = packAccentCss(pack);
  if (!css) return;
  let style = document.head.querySelector<HTMLStyleElement>(`style[${ATTRIBUTE}="${pack.id}"]`);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute(ATTRIBUTE, pack.id);
    document.head.appendChild(style);
  }
  style.textContent = css;
}

export function removePackAccents(packId: string): void {
  if (typeof document === "undefined") return;
  document.head.querySelector(`style[${ATTRIBUTE}="${packId}"]`)?.remove();
}
