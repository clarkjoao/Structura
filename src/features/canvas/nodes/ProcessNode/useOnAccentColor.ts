import { useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import { contrastLabelColor } from "@/features/diagram/utils/labelContrast";

const TOKEN_RE = /^hsl\(\s*var\((--[\w-]+)\)\s*\)$/;

/**
 * A concrete colour for `color`, reading theme tokens from the document.
 *
 * Accent presets are stored as `hsl(var(--node-system))` so they follow the
 * theme, but a contrast ratio needs channels: the token is looked up in the
 * active theme. Anything that is not a token is returned as is.
 */
export function resolveThemeColor(color: string): string {
  const token = TOKEN_RE.exec(color.trim());
  if (!token || typeof document === "undefined") return color;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token[1]).trim();
  return value ? `hsl(${value})` : color;
}

/**
 * Text colour that reads on a body filled with `accent` — light or dark by WCAG
 * contrast (4.5:1), so amber gets dark text and violet gets light text without
 * either being listed anywhere. Recomputed when the theme flips, because the
 * token behind a preset resolves to a different lightness in each theme.
 */
export function useOnAccentColor(accent: string, enabled: boolean): string {
  const { theme } = useTheme();
  return useMemo(() => {
    if (!enabled) return "";
    return contrastLabelColor(resolveThemeColor(accent), 100);
    // `theme` is a dependency for what it does to the tokens, not read here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, enabled, theme]);
}
