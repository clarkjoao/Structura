import { parseCssColorToRgb } from "@/features/diagram";

export function withAlpha(color: string, opacityPct: number): string {
  const rgb = parseCssColorToRgb(color);
  if (!rgb) return color;
  const alpha = Math.max(0, Math.min(1, opacityPct / 100));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
