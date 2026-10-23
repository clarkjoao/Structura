/**
 * How the author wants the auto-layout to arrange this diagram.
 *
 * Diagram data, not a browser preference: the arrangement is part of how the
 * diagram reads, so the viewer, a shared link, a connected folder and a
 * collaborator all see the same one. Every field is optional and absent means
 * the layout the editor always ran, so a diagram nobody tuned stays
 * byte-identical in storage and exports.
 */
export type LayoutDensity = "compact" | "normal" | "spacious";

/**
 * Whether the diagram is arranged only on request (`manual`) or after every
 * structural edit the author makes (`automatic`).
 */
export type LayoutMode = "manual" | "automatic";

export interface DiagramLayoutSettings {
  /** Absent means `"manual"`: nothing moves until the author arranges. */
  mode?: LayoutMode;
  /** Scales every tuned layout spacing. Absent means `"normal"`. */
  density?: LayoutDensity;
  /** Gap between consecutive layers, overriding the density for that spacing. */
  layerGap?: number;
  /** Gap between nodes in the same layer, overriding the density for that spacing. */
  nodeGap?: number;
}

export const LAYOUT_DENSITIES: readonly LayoutDensity[] = ["compact", "normal", "spacious"];

/**
 * The factor each density applies to the tuned spacings. Normal is exactly 1:
 * it is the layout the readability baselines lock.
 */
export const LAYOUT_DENSITY_FACTOR: Readonly<Record<LayoutDensity, number>> = {
  compact: 0.75,
  normal: 1,
  spacious: 1.4,
};

/** Bounds for the advanced gaps, so a stored or received value cannot break the layout. */
export const LAYOUT_GAP_MIN = 40;
export const LAYOUT_GAP_MAX = 300;

function isLayoutDensity(value: unknown): value is LayoutDensity {
  return typeof value === "string" && (LAYOUT_DENSITIES as readonly string[]).includes(value);
}

export function clampLayoutGap(value: number): number {
  return Math.round(Math.min(LAYOUT_GAP_MAX, Math.max(LAYOUT_GAP_MIN, value)));
}

function normalizedGap(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? clampLayoutGap(value) : undefined;
}

/**
 * The settings as they should be stored: defaults dropped, gaps clamped, and
 * `undefined` when nothing differs from the default. Anything unrecognised is
 * dropped rather than trusted, since the value can come from an imported file
 * or a collaborator.
 */
export function normalizeLayoutSettings(
  settings: DiagramLayoutSettings | undefined,
): DiagramLayoutSettings | undefined {
  if (!settings) return undefined;
  const normalized: DiagramLayoutSettings = {};
  if (settings.mode === "automatic") normalized.mode = "automatic";
  if (isLayoutDensity(settings.density) && settings.density !== "normal") {
    normalized.density = settings.density;
  }
  const layerGap = normalizedGap(settings.layerGap);
  if (layerGap !== undefined) normalized.layerGap = layerGap;
  const nodeGap = normalizedGap(settings.nodeGap);
  if (nodeGap !== undefined) normalized.nodeGap = nodeGap;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** Whether a diagram re-arranges itself after each structural edit. */
export function isAutomaticLayout(settings: DiagramLayoutSettings | undefined): boolean {
  return settings?.mode === "automatic";
}

/** Whether two settings are the same once normalised. */
export function sameLayoutSettings(
  a: DiagramLayoutSettings | undefined,
  b: DiagramLayoutSettings | undefined,
): boolean {
  const left = normalizeLayoutSettings(a);
  const right = normalizeLayoutSettings(b);
  return (
    left?.mode === right?.mode &&
    left?.density === right?.density &&
    left?.layerGap === right?.layerGap &&
    left?.nodeGap === right?.nodeGap
  );
}
