/**
 * WCAG-oriented label colour against a translucent fill over a light canvas.
 *
 * @example
 * contrastLabelColor("#000000", 100) // → "#ffffff"
 * contrastLabelColor("#ffffff", 100) // → "#0a0a0a"
 */

export type RgbColor = { r: number; g: number; b: number };

const FALLBACK_LABEL = "#0a0a0a";
const DARK_LABEL = "#0a0a0a";
const LIGHT_LABEL = "#ffffff";
const MIN_CONTRAST = 4.5;
const WHITE: RgbColor = { r: 255, g: 255, b: 255 };

/** Parse `#rgb` / `#rrggbb`, `hsl(h s% l%)`, `rgb()` / `rgba()` into 0–255 channels. */
export function parseCssColorToRgb(color: string): RgbColor | null {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((channel) => channel + channel)
        .join("");
    }
    if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+%?)?\s*\)$/i,
  );
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return null;
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }

  const hslMatch = trimmed.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    if (![h, s, l].every(Number.isFinite)) return null;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return {
      r: Math.round(f(0) * 255),
      g: Math.round(f(8) * 255),
      b: Math.round(f(4) * 255),
    };
  }

  return null;
}

/** Format RGB as `#rrggbb` for panel storage and CSS. */
export function rgbToHex({ r, g, b }: RgbColor): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function relativeLuminance({ r, g, b }: RgbColor): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Label colour (≥ WCAG AA 4.5:1) for a lane fill blended toward white by opacity.
 * Invalid colour → dark label. Alpha inputs use only RGB channels (alpha discarded).
 */
export function contrastLabelColor(laneColor: string, opacityPct: number): string {
  const laneRgb = parseCssColorToRgb(laneColor);
  if (!laneRgb) return FALLBACK_LABEL;

  const alpha = Math.max(0, Math.min(1, opacityPct / 100));
  const effective: RgbColor = {
    r: Math.round(laneRgb.r + (WHITE.r - laneRgb.r) * (1 - alpha)),
    g: Math.round(laneRgb.g + (WHITE.g - laneRgb.g) * (1 - alpha)),
    b: Math.round(laneRgb.b + (WHITE.b - laneRgb.b) * (1 - alpha)),
  };

  const dark = parseCssColorToRgb(DARK_LABEL)!;
  const light = parseCssColorToRgb(LIGHT_LABEL)!;
  const darkRatio = contrastRatio(dark, effective);
  const lightRatio = contrastRatio(light, effective);

  if (darkRatio >= MIN_CONTRAST && darkRatio >= lightRatio) return DARK_LABEL;
  if (lightRatio >= MIN_CONTRAST) return LIGHT_LABEL;
  return darkRatio >= lightRatio ? DARK_LABEL : LIGHT_LABEL;
}
