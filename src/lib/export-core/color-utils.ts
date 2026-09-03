/**
 * Color helpers used by the drawio/mermaid export pipeline. We keep these local
 * to export-core so the core stays framework-agnostic (no `@/features/*` import).
 */

const HEX_RE = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

/** Convert `hsl(h s% l%)` (with optional whitespace) to a `#rrggbb` hex string. */
export function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/);
  if (!match) return hsl;
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Normalise any colour we get from the panel palette to a hex string. */
export function toHex(color: string): string {
  if (!color) return color;
  if (color.startsWith("#")) return color;
  if (color.startsWith("hsl")) return hslToHex(color);
  return color;
}

/**
 * Mix a colour toward white by `amount` ∈ [0, 1]. Used to render a panel's
 * translucent fill as a drawio `fillColor` (drawio has no alpha on `fillColor`,
 * only on `fillOpacity` — combining a lighter hex with low fillOpacity mimics
 * the canvas's tinted background more faithfully than a saturated hex alone).
 */
export function mixWithWhite(hex: string, amount: number): string {
  const m = HEX_RE.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const blend = (c: number) => Math.round(c + (255 - c) * Math.max(0, Math.min(1, amount)));
  return `#${[blend(r), blend(g), blend(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
