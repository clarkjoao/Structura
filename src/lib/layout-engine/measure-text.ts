/**
 * `MeasureText` implementations.
 *
 * The browser measures with a real canvas, so the engine sees the same advance widths the
 * font will paint. Headless callers (Vitest, any non-DOM consumer) use the metrics-table
 * approximation, which is deterministic and needs no DOM.
 */

import type { MeasureText } from "./measure";
import type { TextStyle } from "./typography";

function fontShorthand(style: TextStyle): string {
  return `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
}

/**
 * Canvas-backed measurer. Reuses one offscreen context across calls and caches per font,
 * since `measureText` is hot during layout.
 *
 * Returns `null` when no 2D context is available (jsdom without the `canvas` package),
 * so callers can fall back rather than crash.
 */
export function createCanvasMeasureText(): MeasureText | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let currentFont = "";

  return (text: string, style: TextStyle): number => {
    const font = fontShorthand(style);
    if (font !== currentFont) {
      ctx.font = font;
      currentFont = font;
    }
    const width = ctx.measureText(text).width;
    return width + style.letterSpacing * Math.max(0, text.length - 1);
  };
}

/**
 * Average advance width per character, as a fraction of font size.
 *
 * Derived from the system UI stack at weight 400/700. Proportional fonts vary per glyph,
 * so this is an approximation — good enough for deterministic tests and for a headless
 * fallback, but the browser path should always prefer the canvas measurer.
 */
const AVG_CHAR_RATIO_SANS = 0.5;
const AVG_CHAR_RATIO_MONO = 0.6;
/** Bold text advances slightly wider than regular at the same size. */
const BOLD_WIDTH_FACTOR = 1.06;

/** Characters that are reliably narrower than the average advance. */
const NARROW_CHARS = new Set("iIl1.,:;'`|!ftjr()[]{}-");
/** Characters that are reliably wider. */
const WIDE_CHARS = new Set("MWmw@%");

const NARROW_FACTOR = 0.45;
const WIDE_FACTOR = 1.5;

/**
 * Deterministic measurer with no DOM dependency.
 *
 * Walks the string classifying each glyph as narrow/wide/average, which tracks real
 * proportional metrics far better than a flat character count.
 */
export const approximateMeasureText: MeasureText = (text: string, style: TextStyle): number => {
  if (!text) return 0;

  const isMono = style.fontFamily.includes("mono");
  const baseRatio = isMono ? AVG_CHAR_RATIO_MONO : AVG_CHAR_RATIO_SANS;
  const weightFactor = style.fontWeight >= 600 ? BOLD_WIDTH_FACTOR : 1;

  let units = 0;
  for (const char of text) {
    if (isMono) {
      units += 1;
    } else if (NARROW_CHARS.has(char)) {
      units += NARROW_FACTOR;
    } else if (WIDE_CHARS.has(char)) {
      units += WIDE_FACTOR;
    } else {
      units += 1;
    }
  }

  const width = units * style.fontSize * baseRatio * weightFactor;
  return width + style.letterSpacing * Math.max(0, text.length - 1);
};

/** Canvas measurer when a DOM is available, approximation otherwise. */
export function resolveMeasureText(): MeasureText {
  return createCanvasMeasureText() ?? approximateMeasureText;
}
