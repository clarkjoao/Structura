/** Maximum serialized SVG string length accepted before sanitization (UTF-16 code units). */
export const SVG_MAX_BYTES = 500_000;

/** Maximum width or height in pixels (from `viewBox` or root `width` / `height`). */
export const SVG_MAX_DIMENSION = 2_000;

export interface SvgSizeValidationResult {
  valid: boolean;
  reason?: "too_large" | "dimension_exceeded";
}

/**
 * Rejects oversized markup or huge intrinsic dimensions before parsing/sanitization.
 * Does not throw; invalid XML is left to the sanitizer (`{ valid: true }` on parse errors).
 */
export function validateSvgSize(
  svgString: string,
  maxBytes = SVG_MAX_BYTES,
  maxDimension = SVG_MAX_DIMENSION,
): SvgSizeValidationResult {
  if (svgString.length > maxBytes) {
    return { valid: false, reason: "too_large" };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) {
      return { valid: true };
    }

    const viewBoxParts = svgEl.getAttribute("viewBox")?.trim().split(/[\s,]+/);
    if (viewBoxParts && viewBoxParts.length === 4) {
      const viewBoxWidth = parseFloat(viewBoxParts[2]!);
      const viewBoxHeight = parseFloat(viewBoxParts[3]!);
      if (
        (viewBoxWidth > 0 && viewBoxWidth > maxDimension) ||
        (viewBoxHeight > 0 && viewBoxHeight > maxDimension)
      ) {
        return { valid: false, reason: "dimension_exceeded" };
      }
    } else {
      const width = parseFloat(svgEl.getAttribute("width") ?? "0");
      const height = parseFloat(svgEl.getAttribute("height") ?? "0");
      if (
        (width > 0 && width > maxDimension) ||
        (height > 0 && height > maxDimension)
      ) {
        return { valid: false, reason: "dimension_exceeded" };
      }
    }
  } catch {
    // Parse error — sanitizer handles invalid XML downstream.
  }

  return { valid: true };
}

/**
 * Compact SVG markup for storage: strips XML prolog and comments, tightens tag gaps.
 * Does not collapse spaces inside text nodes (only between tags).
 */
export function normalizeSvgForStorage(svgContent: string): string {
  let result = svgContent;
  result = result.replace(/<\?xml[^?]*\?>\s*/gi, "");
  result = result.replace(/<!--[\s\S]*?-->/g, "");
  result = result.replace(/>\s+</g, "><");
  return result.trim();
}

const ICON_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Format: `icon_<timestamp>_<random4chars>` */
export function generateIconId(): string {
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    const charIndex = Math.floor(Math.random() * ICON_ID_ALPHABET.length);
    suffix += ICON_ID_ALPHABET[charIndex]!;
  }
  return `icon_${Date.now()}_${suffix}`;
}
