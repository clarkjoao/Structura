import { useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";

const LIGHT_BACKDROP = "#ffffff";

/**
 * The colour translucent node fills (panels, swimlanes) are painted over, for
 * `contrastLabelColor`. Light keeps the white it has always assumed; dark reads the
 * theme's `--background` token so the label colour follows the palette in `index.css`.
 */
export function useCanvasBackdrop(): string {
  const { theme } = useTheme();
  return useMemo(() => {
    if (theme !== "dark" || typeof document === "undefined") return LIGHT_BACKDROP;
    const token = getComputedStyle(document.documentElement).getPropertyValue("--background");
    return token.trim() ? `hsl(${token.trim()})` : LIGHT_BACKDROP;
  }, [theme]);
}
