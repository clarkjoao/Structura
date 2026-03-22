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
