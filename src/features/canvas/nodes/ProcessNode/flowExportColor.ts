import {
  contrastLabelColor,
  parseCssColorToRgb,
  rgbToHex,
} from "@/features/diagram/utils/labelContrast";
import {
  FLOW_DEFAULT_ACCENT,
  resolveFlowAppearance,
  type FlowAppearanceInput,
} from "./flowAppearance";

/**
 * The light theme's value for each token an accent preset can name, as in
 * `src/index.css`. draw.io has no theme to resolve `var(--…)` against, so an
 * export takes the light values — the ones a reader of the exported file is
 * most likely to be looking at. `flowExportColor.test.ts` pins this table to
 * `index.css`.
 */
export const LIGHT_THEME_TOKENS: Readonly<Record<string, string>> = {
  "--muted-foreground": "215 16% 47%",
  "--node-system": "187 72% 40%",
  "--node-container": "260 60% 48%",
  "--node-component": "152 60% 38%",
  "--node-person": "38 92% 50%",
  "--gcp-database": "214 75% 45%",
};

const TOKEN_RE = /^hsl\(\s*var\((--[\w-]+)\)\s*\)$/;

/** `color` as `#rrggbb`, resolving a theme token to its light value; `null` if unreadable. */
export function exportColorHex(color: string): string | null {
  const token = TOKEN_RE.exec(color.trim());
  const concrete = token
    ? LIGHT_THEME_TOKENS[token[1]]
      ? `hsl(${LIGHT_THEME_TOKENS[token[1]]})`
      : null
    : color;
  if (concrete === null) return null;
  const rgb = parseCssColorToRgb(concrete);
  return rgb ? rgbToHex(rgb) : null;
}

/** The colour parts of a skinned node, resolved for an export. */
export function flowExportColours(
  input: FlowAppearanceInput,
  defaultAccent: string = FLOW_DEFAULT_ACCENT,
): {
  accentColor: string;
  fill: "none" | "soft" | "solid";
  dashed: boolean;
  fontColor?: string;
} {
  const appearance = resolveFlowAppearance(input, defaultAccent);
  const fallback = exportColorHex(FLOW_DEFAULT_ACCENT)!;
  const accentColor = exportColorHex(appearance.accent) ?? fallback;
  return {
    accentColor,
    fill: appearance.fill,
    dashed: appearance.stroke === "dashed",
    ...(appearance.fill === "solid" ? { fontColor: contrastLabelColor(accentColor, 100) } : {}),
  };
}
