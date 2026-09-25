import type {
  FlowNodeShape,
  NodeFillMode,
  NodeStrokeMode,
} from "@/features/diagram/model/component.types";

/**
 * Colour in parts, not as a whole: an accent, how the accent fills the body,
 * and how the outline is drawn. Typography, shadow, radius and handles are
 * fixed — they are what make a flowchart shape read as one of Structura's.
 *
 * Every colour here is a CSS value built from the theme's custom properties,
 * so dark mode follows without a second palette. Tints are `color-mix` over the
 * card surface rather than a translucent fill, because a translucent fill would
 * let the canvas grid show through the shape.
 */

/** Slate: the flow family's default, so a new flowchart does not come out coloured. */
export const FLOW_DEFAULT_ACCENT = "hsl(var(--muted-foreground))";

const SURFACE = "hsl(var(--card))";
const NEUTRAL_BORDER = "hsl(var(--border))";
const TITLE = "hsl(var(--foreground))";
const MUTED_TEXT = "hsl(var(--muted-foreground))";
const CHIP_BG = "hsl(var(--muted))";
const CHIP_TEXT = "hsl(var(--secondary-foreground))";

/** The three parts, as stored — every one optional, absent meaning its default. */
export interface FlowAppearanceInput {
  /** Some shapes have their own default for a part (evidence is dashed). */
  flowShape?: FlowNodeShape;
  customColor?: string;
  /** Legacy fill colour; see `ProcessNodeComponent.nodeColor`. */
  nodeColor?: string;
  fill?: NodeFillMode;
  stroke?: NodeStrokeMode;
}

/** The parts with their defaults resolved. */
export interface ResolvedFlowAppearance {
  accent: string;
  fill: NodeFillMode;
  stroke: NodeStrokeMode;
}

/**
 * Defaults are resolved here, at render, and never written back: a diagram no
 * one edited must hash the same as it did before this existed.
 *
 * A legacy `nodeColor` was a whole-body colour, so a node that has one and no
 * accent of its own keeps looking filled: it becomes the accent, painted solid.
 */
export function resolveFlowAppearance(input: FlowAppearanceInput): ResolvedFlowAppearance {
  const legacyFill = !input.customColor && !!input.nodeColor;
  return {
    accent: input.customColor ?? input.nodeColor ?? FLOW_DEFAULT_ACCENT,
    fill: input.fill ?? (legacyFill ? "solid" : "none"),
    stroke: input.stroke ?? defaultStrokeFor(input.flowShape),
  };
}

/**
 * The stroke a shape has when none is stored. Physical evidence is drawn
 * dashed — it is what the customer sees, not a step anyone performs.
 */
export function defaultStrokeFor(shape: FlowNodeShape | undefined): NodeStrokeMode {
  return shape === "evidence" ? "dashed" : "solid";
}

/** `color` at `percent`% over `base`. */
export function mix(color: string, percent: number, base: string = SURFACE): string {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

/** Every colour a shape paints, derived from its resolved appearance. */
export interface FlowPalette {
  /** Whether the body is filled with the accent — text and icon then use `onAccent`. */
  solid: boolean;
  accent: string;
  /** Body fill. */
  surface: string;
  /** Neutral outline (card shapes, io, cylinder body). */
  border: string;
  /** Soft accent wash — badges, the decision's body, the cylinder's cap. */
  tint: string;
  /** Outline for shapes whose outline *is* the accent (decision, circle). */
  accentOutline: string;
  /** Icon colour. */
  icon: string;
  title: string;
  muted: string;
  chipBg: string;
  chipText: string;
  borderStyle: "solid" | "dashed";
  /** SVG `stroke-dasharray` for the dashed outline, `undefined` when solid. */
  dashArray: string | undefined;
}

/**
 * The colours for one appearance. `onAccent` is the text colour that reads on
 * the accent — computed by contrast, never picked from a list — and is only
 * used when the fill is solid.
 */
export function flowPalette(appearance: ResolvedFlowAppearance, onAccent: string): FlowPalette {
  const { accent, fill, stroke } = appearance;
  const dashed = stroke === "dashed";
  const common = {
    solid: fill === "solid",
    accent,
    borderStyle: dashed ? ("dashed" as const) : ("solid" as const),
    dashArray: dashed ? "5 3" : undefined,
  };

  if (fill === "solid") {
    return {
      ...common,
      surface: accent,
      border: accent,
      tint: mix(onAccent, 18, accent),
      accentOutline: accent,
      icon: onAccent,
      title: onAccent,
      muted: mix(onAccent, 80, accent),
      chipBg: mix(onAccent, 18, accent),
      chipText: onAccent,
    };
  }

  if (fill === "soft") {
    return {
      ...common,
      surface: mix(accent, 8),
      border: `color-mix(in srgb, ${accent} 30%, transparent)`,
      tint: mix(accent, 14),
      accentOutline: accent,
      icon: accent,
      title: TITLE,
      muted: MUTED_TEXT,
      chipBg: CHIP_BG,
      chipText: CHIP_TEXT,
    };
  }

  return {
    ...common,
    surface: SURFACE,
    border: NEUTRAL_BORDER,
    tint: mix(accent, 8),
    accentOutline: accent,
    icon: accent,
    title: TITLE,
    muted: MUTED_TEXT,
    chipBg: CHIP_BG,
    chipText: CHIP_TEXT,
  };
}

/**
 * What to store for a picked accent: nothing for the family default, so picking
 * slate is the same as never having picked.
 */
export function accentToStore(color: string): string | undefined {
  return color === FLOW_DEFAULT_ACCENT ? undefined : color;
}
