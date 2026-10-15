/**
 * The styles a `text` element can take — a closed set on purpose. Free-form
 * fonts and colours are what would turn a planning aid into a design tool.
 */
export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const DEFAULT_TEXT_SIZE: TextSize = "md";

export const TEXT_COLORS = ["default", "muted", "blue", "green", "amber", "red"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];
export const DEFAULT_TEXT_COLOR: TextColor = "default";

export const isTextSize = (value: unknown): value is TextSize =>
  typeof value === "string" && (TEXT_SIZES as readonly string[]).includes(value);

export const isTextColor = (value: unknown): value is TextColor =>
  typeof value === "string" && (TEXT_COLORS as readonly string[]).includes(value);
