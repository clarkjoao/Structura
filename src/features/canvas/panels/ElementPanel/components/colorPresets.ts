export interface ColorPreset {
  
  nameKey: string;
  color: string;
}


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


export const PANEL_PRESETS: ColorPreset[] = [
  ...VIBRANT_PRESETS,
  ...NEUTRAL_PRESETS,
];


export const NOTE_PRESETS: ColorPreset[] = [
  ...PAPER_PRESETS,
  ...VIBRANT_PRESETS.slice(0, 8),
];


export const C4_DEFAULT_COLORS: Record<string, string> = {
  person: "hsl(38 92% 50%)",
  system: "hsl(187 72% 51%)",
  container: "hsl(260 60% 55%)",
  component: "hsl(152 60% 45%)",
};
