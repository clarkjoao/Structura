export interface ColorPreset {
  name: string;
  color: string;
}

/** Cores vibrantes — painéis e destaques */
export const VIBRANT_PRESETS: ColorPreset[] = [
  { name: "Azul", color: "hsl(220 70% 50%)" },
  { name: "Índigo", color: "hsl(250 70% 55%)" },
  { name: "Violeta", color: "hsl(270 70% 55%)" },
  { name: "Roxo", color: "hsl(280 65% 50%)" },
  { name: "Rosa", color: "hsl(330 75% 55%)" },
  { name: "Vermelho", color: "hsl(0 70% 50%)" },
  { name: "Laranja", color: "hsl(25 90% 52%)" },
  { name: "Âmbar", color: "hsl(38 92% 50%)" },
  { name: "Amarelo", color: "hsl(45 93% 47%)" },
  { name: "Lima", color: "hsl(84 70% 45%)" },
  { name: "Verde", color: "hsl(150 65% 42%)" },
  { name: "Esmeralda", color: "hsl(160 60% 40%)" },
  { name: "Teal", color: "hsl(175 65% 42%)" },
  { name: "Ciano", color: "hsl(190 80% 45%)" },
  { name: "Céu", color: "hsl(200 75% 50%)" },
];

/** Tons de papel — notas e fundos suaves */
export const PAPER_PRESETS: ColorPreset[] = [
  { name: "Branco", color: "hsl(0 0% 98%)" },
  { name: "Marfim", color: "hsl(45 25% 97%)" },
  { name: "Creme", color: "hsl(40 30% 95%)" },
  { name: "Areia", color: "hsl(35 25% 92%)" },
  { name: "Pergaminho", color: "hsl(38 20% 90%)" },
  { name: "Bege claro", color: "hsl(30 25% 88%)" },
  { name: "Amarelo pálido", color: "hsl(50 60% 94%)" },
  { name: "Menta suave", color: "hsl(160 30% 94%)" },
  { name: "Azul claro", color: "hsl(210 40% 95%)" },
  { name: "Lavanda", color: "hsl(260 30% 94%)" },
  { name: "Rosa pálido", color: "hsl(340 40% 95%)" },
  { name: "Cinza claro", color: "hsl(220 15% 92%)" },
];

/** Cores C4 — alinhadas aos tipos do modelo */
export const C4_PRESETS: ColorPreset[] = [
  { name: "Person", color: "hsl(38 92% 50%)" },
  { name: "System", color: "hsl(187 72% 51%)" },
  { name: "Container", color: "hsl(260 60% 55%)" },
  { name: "Component", color: "hsl(152 60% 45%)" },
  { name: "Azul escuro", color: "hsl(220 70% 40%)" },
  { name: "Verde escuro", color: "hsl(150 50% 35%)" },
  { name: "Vermelho escuro", color: "hsl(0 60% 42%)" },
  { name: "Âmbar escuro", color: "hsl(35 80% 42%)" },
];

/** Neutros — painéis discretos */
export const NEUTRAL_PRESETS: ColorPreset[] = [
  { name: "Cinza escuro", color: "hsl(220 20% 20%)" },
  { name: "Slate", color: "hsl(215 25% 25%)" },
  { name: "Grafite", color: "hsl(220 15% 18%)" },
  { name: "Charcoal", color: "hsl(210 20% 22%)" },
  { name: "Cinza médio", color: "hsl(220 15% 35%)" },
  { name: "Cinza", color: "hsl(220 10% 45%)" },
];

/** Painéis — vibrantes + neutros */
export const PANEL_PRESETS: ColorPreset[] = [
  ...VIBRANT_PRESETS,
  ...NEUTRAL_PRESETS,
];

/** Notas — papel + vibrantes para variedade */
export const NOTE_PRESETS: ColorPreset[] = [
  ...PAPER_PRESETS,
  ...VIBRANT_PRESETS.slice(0, 8),
];

/** Cores padrão por tipo C4 (person, system, container, component) */
export const C4_DEFAULT_COLORS: Record<string, string> = {
  person: "hsl(38 92% 50%)",
  system: "hsl(187 72% 51%)",
  container: "hsl(260 60% 55%)",
  component: "hsl(152 60% 45%)",
};