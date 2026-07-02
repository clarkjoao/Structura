export interface ColorPreset {
  nameKey: string;
  color: string;
}

// ─── Note theme defaults ─────────────────────────────────────────────────────
export const NOTE_DEFAULT_LIGHT = "hsl(45 25% 97%)";
export const NOTE_DEFAULT_DARK = "hsl(38 10% 15%)";

// Each entry maps the light ↔ dark HSL for a single semantic color intention.
export interface NotePresetPair {
  light: string;
  dark: string;
}

export const NOTE_PRESET_PAIRS: NotePresetPair[] = [
  { light: "hsl(45 25% 97%)", dark: "hsl(38 10% 15%)" }, // ivory     ↔ warm dark paper
  { light: "hsl(0 0% 98%)", dark: "hsl(220 15% 18%)" }, // white     ↔ graphite
  { light: "hsl(40 30% 95%)", dark: "hsl(210 12% 20%)" }, // cream     ↔ charcoal
  { light: "hsl(35 25% 92%)", dark: "hsl(215 20% 19%)" }, // sand      ↔ slate
  { light: "hsl(38 20% 90%)", dark: "hsl(220 18% 22%)" }, // parchment ↔ grayDark
  { light: "hsl(30 25% 88%)", dark: "hsl(220 12% 28%)" }, // lightBeige↔ grayMedium
  { light: "hsl(50 60% 94%)", dark: "hsl(38 10% 15%)" }, // paleYellow↔ warm dark (same as ivory)
  { light: "hsl(160 30% 94%)", dark: "hsl(160 13% 17%)" }, // softMint  ↔ darkMint
  { light: "hsl(210 40% 95%)", dark: "hsl(200 20% 18%)" }, // lightBlue ↔ darkOcean
  { light: "hsl(260 30% 94%)", dark: "hsl(270 14% 19%)" }, // lavender  ↔ darkViolet
  { light: "hsl(340 40% 95%)", dark: "hsl(340 12% 19%)" }, // palePink  ↔ darkRose
  { light: "hsl(220 15% 92%)", dark: "hsl(220 15% 25%)" }, // lightGray ↔ dark gray
  // vibrants: identical in both themes
  { light: "hsl(220 70% 50%)", dark: "hsl(220 70% 50%)" },
  { light: "hsl(250 70% 55%)", dark: "hsl(250 70% 55%)" },
  { light: "hsl(270 70% 55%)", dark: "hsl(270 70% 55%)" },
  { light: "hsl(280 65% 50%)", dark: "hsl(280 65% 50%)" },
  { light: "hsl(330 75% 55%)", dark: "hsl(330 75% 55%)" },
  { light: "hsl(0 70% 50%)", dark: "hsl(0 70% 50%)" },
  { light: "hsl(25 90% 52%)", dark: "hsl(25 90% 52%)" },
  { light: "hsl(38 92% 50%)", dark: "hsl(38 92% 50%)" },
];

// Reverse-lookup maps built once at module load.
const _LIGHT_TO_PAIR = new Map<string, NotePresetPair>(NOTE_PRESET_PAIRS.map((p) => [p.light, p]));
const _DARK_TO_PAIR = new Map<string, NotePresetPair>();
for (const p of NOTE_PRESET_PAIRS) {
  if (!_DARK_TO_PAIR.has(p.dark)) {
    _DARK_TO_PAIR.set(p.dark, p);
  }
}

/**
 * Returns the light↔dark pair for a given CSS color (looked up from either side),
 * or null if it is a custom color not in any preset.
 */
export function getNotePresetPair(cssColor: string): NotePresetPair | null {
  return _LIGHT_TO_PAIR.get(cssColor) ?? _DARK_TO_PAIR.get(cssColor) ?? null;
}
// ─────────────────────────────────────────────────────────────────────────────

export const VIBRANT_PRESETS: ColorPreset[] = [
  { nameKey: "colors.blue", color: "hsl(220 70% 50%)" },
  { nameKey: "colors.indigo", color: "hsl(250 70% 55%)" },
  { nameKey: "colors.violet", color: "hsl(270 70% 55%)" },
  { nameKey: "colors.purple", color: "hsl(280 65% 50%)" },
  { nameKey: "colors.pink", color: "hsl(330 75% 55%)" },
  { nameKey: "colors.red", color: "hsl(0 70% 50%)" },
  { nameKey: "colors.orange", color: "hsl(25 90% 52%)" },
  { nameKey: "colors.amber", color: "hsl(38 92% 50%)" },
  { nameKey: "colors.yellow", color: "hsl(45 93% 47%)" },
  { nameKey: "colors.lime", color: "hsl(84 70% 45%)" },
  { nameKey: "colors.green", color: "hsl(150 65% 42%)" },
  { nameKey: "colors.emerald", color: "hsl(160 60% 40%)" },
  { nameKey: "colors.teal", color: "hsl(175 65% 42%)" },
  { nameKey: "colors.cyan", color: "hsl(190 80% 45%)" },
  { nameKey: "colors.sky", color: "hsl(200 75% 50%)" },
];

export const PAPER_PRESETS: ColorPreset[] = [
  { nameKey: "colors.white", color: "hsl(0 0% 98%)" },
  { nameKey: "colors.ivory", color: "hsl(45 25% 97%)" },
  { nameKey: "colors.cream", color: "hsl(40 30% 95%)" },
  { nameKey: "colors.sand", color: "hsl(35 25% 92%)" },
  { nameKey: "colors.parchment", color: "hsl(38 20% 90%)" },
  { nameKey: "colors.lightBeige", color: "hsl(30 25% 88%)" },
  { nameKey: "colors.paleYellow", color: "hsl(50 60% 94%)" },
  { nameKey: "colors.softMint", color: "hsl(160 30% 94%)" },
  { nameKey: "colors.lightBlue", color: "hsl(210 40% 95%)" },
  { nameKey: "colors.lavender", color: "hsl(260 30% 94%)" },
  { nameKey: "colors.palePink", color: "hsl(340 40% 95%)" },
  { nameKey: "colors.lightGray", color: "hsl(220 15% 92%)" },
];

export const C4_PRESETS: ColorPreset[] = [
  { nameKey: "colors.c4Person", color: "hsl(38 92% 50%)" },
  { nameKey: "colors.c4System", color: "hsl(187 72% 51%)" },
  { nameKey: "colors.c4Container", color: "hsl(260 60% 55%)" },
  { nameKey: "colors.c4Component", color: "hsl(152 60% 45%)" },
  { nameKey: "colors.darkBlue", color: "hsl(220 70% 40%)" },
  { nameKey: "colors.darkGreen", color: "hsl(150 50% 35%)" },
  { nameKey: "colors.darkRed", color: "hsl(0 60% 42%)" },
  { nameKey: "colors.darkAmber", color: "hsl(35 80% 42%)" },
];

export const NEUTRAL_PRESETS: ColorPreset[] = [
  { nameKey: "colors.grayDark", color: "hsl(220 20% 20%)" },
  { nameKey: "colors.slate", color: "hsl(215 25% 25%)" },
  { nameKey: "colors.graphite", color: "hsl(220 15% 18%)" },
  { nameKey: "colors.charcoal", color: "hsl(210 20% 22%)" },
  { nameKey: "colors.grayMedium", color: "hsl(220 15% 35%)" },
  { nameKey: "colors.gray", color: "hsl(220 10% 45%)" },
];

export const PANEL_PRESETS: ColorPreset[] = [...VIBRANT_PRESETS, ...NEUTRAL_PRESETS];

export const NOTE_PRESETS: ColorPreset[] = [
  { nameKey: "colors.ivory", color: "hsl(45 25% 97%)" },
  { nameKey: "colors.white", color: "hsl(0 0% 98%)" },
  { nameKey: "colors.cream", color: "hsl(40 30% 95%)" },
  { nameKey: "colors.sand", color: "hsl(35 25% 92%)" },
  { nameKey: "colors.parchment", color: "hsl(38 20% 90%)" },
  { nameKey: "colors.lightBeige", color: "hsl(30 25% 88%)" },
  { nameKey: "colors.paleYellow", color: "hsl(50 60% 94%)" },
  { nameKey: "colors.softMint", color: "hsl(160 30% 94%)" },
  { nameKey: "colors.lightBlue", color: "hsl(210 40% 95%)" },
  { nameKey: "colors.lavender", color: "hsl(260 30% 94%)" },
  { nameKey: "colors.palePink", color: "hsl(340 40% 95%)" },
  { nameKey: "colors.lightGray", color: "hsl(220 15% 92%)" },
  { nameKey: "colors.blue", color: "hsl(220 70% 50%)" },
  { nameKey: "colors.indigo", color: "hsl(250 70% 55%)" },
  { nameKey: "colors.violet", color: "hsl(270 70% 55%)" },
  { nameKey: "colors.purple", color: "hsl(280 65% 50%)" },
  { nameKey: "colors.pink", color: "hsl(330 75% 55%)" },
  { nameKey: "colors.red", color: "hsl(0 70% 50%)" },
  { nameKey: "colors.orange", color: "hsl(25 90% 52%)" },
  { nameKey: "colors.amber", color: "hsl(38 92% 50%)" },
];

export const NOTE_PRESETS_DARK: ColorPreset[] = [
  { nameKey: "colors.darkPaper", color: "hsl(38 10% 15%)" },
  { nameKey: "colors.graphite", color: "hsl(220 15% 18%)" },
  { nameKey: "colors.charcoal", color: "hsl(210 12% 20%)" },
  { nameKey: "colors.slate", color: "hsl(215 20% 19%)" },
  { nameKey: "colors.grayDark", color: "hsl(220 18% 22%)" },
  { nameKey: "colors.grayMedium", color: "hsl(220 12% 28%)" },
  { nameKey: "colors.darkMint", color: "hsl(160 13% 17%)" },
  { nameKey: "colors.darkOcean", color: "hsl(200 20% 18%)" },
  { nameKey: "colors.darkViolet", color: "hsl(270 14% 19%)" },
  { nameKey: "colors.darkRose", color: "hsl(340 12% 19%)" },
  { nameKey: "colors.blue", color: "hsl(220 70% 50%)" },
  { nameKey: "colors.indigo", color: "hsl(250 70% 55%)" },
  { nameKey: "colors.violet", color: "hsl(270 70% 55%)" },
  { nameKey: "colors.purple", color: "hsl(280 65% 50%)" },
  { nameKey: "colors.pink", color: "hsl(330 75% 55%)" },
  { nameKey: "colors.red", color: "hsl(0 70% 50%)" },
  { nameKey: "colors.orange", color: "hsl(25 90% 52%)" },
  { nameKey: "colors.amber", color: "hsl(38 92% 50%)" },
];

export const C4_DEFAULT_COLORS: Record<string, string> = {
  person: "hsl(38 92% 50%)",
  system: "hsl(187 72% 51%)",
  container: "hsl(260 60% 55%)",
  component: "hsl(152 60% 45%)",
};
