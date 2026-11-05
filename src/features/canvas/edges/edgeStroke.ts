import { StrokeStyle } from "@/features/diagram";

/** Stroke of an edge with no colour of its own. */
export const DEFAULT_STROKE = "hsl(220 20% 30%)";
/** Stroke of a selected or highlighted edge. */
export const HIGHLIGHT_STROKE = "hsl(187 72% 51%)";

export const strokeDasharrayByStyle: Record<StrokeStyle, string | undefined> = {
  [StrokeStyle.Solid]: undefined,
  [StrokeStyle.Dashed]: "8 4",
  [StrokeStyle.Dotted]: "2 4",
};
