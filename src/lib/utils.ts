import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a color (HSL, RGB, or HEX) to include opacity.
 * For HSL colors like "hsl(220 70% 50%)", appends the alpha channel.
 * For HEX colors like "#ff0000", converts to rgba.
 * For RGB colors like "rgb(255, 0, 0)", appends the alpha channel.
 */
export function colorWithOpacity(color: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");

  // HSL format: hsl(h s% l%)
  const hslMatch = color.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if (hslMatch) {
    return `hsla(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%, ${opacity})`;
  }

  // HSL format with spaces: hsl(h s% l%)
  const hslMatchSpaces = color.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)$/i);
  if (hslMatchSpaces) {
    return `hsla(${hslMatchSpaces[1]}, ${hslMatchSpaces[2]}%, ${hslMatchSpaces[3]}%, ${opacity})`;
  }

  // HEX format
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return `rgba(${parseInt(hex[0] + hex[0], 16)}, ${parseInt(hex[1] + hex[1], 16)}, ${parseInt(hex[2] + hex[2], 16)}, ${opacity})`;
    }
    if (hex.length === 6) {
      return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${opacity})`;
    }
  }

  // RGB format
  const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`;
  }

  // Fallback: return color with appended alpha
  return color + alpha;
}
