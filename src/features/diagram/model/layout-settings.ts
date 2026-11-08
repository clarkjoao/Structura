/**
 * How the author wants the auto-layout to arrange this diagram.
 *
 * Diagram data, not a browser preference: the arrangement is part of how the
 * diagram reads, so the viewer, a shared link, a connected folder and a
 * collaborator all see the same one. Every field is optional and absent means
 * the default arrangement, so a diagram nobody tuned stays byte-identical in
 * storage and exports.
 */
export type LayoutDensity = "compact" | "normal" | "spacious";

/**
 * Whether the diagram is arranged only on request (`manual`) or after every
 * structural edit the author makes (`automatic`).
 */
export type LayoutMode = "manual" | "automatic";

/**
 * How the whole-diagram arrangement makes automatic references.
 *
 * - `rules`: a connection that points back against the reading direction, to
 *   an element further back than `refNeighborColumns` columns, ends on a
 *   reference beside its consumer instead (`layout/ruleRefs.ts`).
 * - `auto`: references are tried hub by hub and kept only where the layout
 *   measurably reads better (`layout/autoRefs.ts`).
 * - `off`: no automatic references; the ones a previous arrangement made go.
 */
export type ReferenceMode = "rules" | "auto" | "off";

export interface DiagramLayoutSettings {
  /** Absent means `"manual"`: nothing moves until the author arranges. */
  mode?: LayoutMode;
  /** Scales every tuned layout spacing. Absent means `"normal"`. */
  density?: LayoutDensity;
  /** Gap between consecutive layers, overriding the density for that spacing. */
  layerGap?: number;
  /** Gap between nodes in the same layer, overriding the density for that spacing. */
  nodeGap?: number;
  /** Absent means `"rules"`. */
  references?: ReferenceMode;
  /**
   * Under `rules`, a back-connection to an element at most this many columns
   * back stays a short back-edge; further back, it ends on a reference.
   * Absent means `REF_NEIGHBOR_COLUMNS_DEFAULT`.
   */
  refNeighborColumns?: number;
  /**
   * Under `rules`, the fewest connections an original keeps: it is never left
   * drawn with nothing but its references. Absent means `REF_MIN_KEEP_DEFAULT`.
   */
  refMinKeep?: number;
  /**
   * Under `rules`, whether a forward connection longer than
   * `REF_FORWARD_COLUMNS` columns ends on a reference too. Absent means off.
   */
  refForward?: boolean;
}

export const LAYOUT_DENSITIES: readonly LayoutDensity[] = ["compact", "normal", "spacious"];

/**
 * The factor each density applies to the tuned spacings. Normal is exactly 1:
 * it is the layout the readability baselines lock.
 */
export const LAYOUT_DENSITY_FACTOR: Readonly<Record<LayoutDensity, number>> = {
  compact: 0.75,
  normal: 1,
  spacious: 1.35,
};

/** Bounds for the advanced gaps, so a stored or received value cannot break the layout. */
export const LAYOUT_GAP_MIN = 40;
export const LAYOUT_GAP_MAX = 308;

export const REFERENCE_MODES: readonly ReferenceMode[] = ["rules", "auto", "off"];
export const REF_NEIGHBOR_COLUMNS_DEFAULT = 2;
export const REF_NEIGHBOR_COLUMNS_MIN = 1;
export const REF_NEIGHBOR_COLUMNS_MAX = 6;
export const REF_MIN_KEEP_DEFAULT = 1;
export const REF_MIN_KEEP_MIN = 1;
export const REF_MIN_KEEP_MAX = 5;
/** A forward connection longer than this many columns ends on a reference under `refForward`. */
export const REF_FORWARD_COLUMNS = 6;

/** The reference settings a diagram arranges with, defaults filled in. */
export interface ReferenceRules {
  mode: ReferenceMode;
  neighborColumns: number;
  minKeep: number;
  forward: boolean;
}

function isReferenceMode(value: unknown): value is ReferenceMode {
  return typeof value === "string" && (REFERENCE_MODES as readonly string[]).includes(value);
}

function clampedInteger(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(Math.min(max, Math.max(min, value)));
}

export function referenceRules(settings: DiagramLayoutSettings | undefined): ReferenceRules {
  return {
    mode: isReferenceMode(settings?.references) ? settings.references : "rules",
    neighborColumns:
      clampedInteger(
        settings?.refNeighborColumns,
        REF_NEIGHBOR_COLUMNS_MIN,
        REF_NEIGHBOR_COLUMNS_MAX,
      ) ?? REF_NEIGHBOR_COLUMNS_DEFAULT,
    minKeep:
      clampedInteger(settings?.refMinKeep, REF_MIN_KEEP_MIN, REF_MIN_KEEP_MAX) ??
      REF_MIN_KEEP_DEFAULT,
    forward: settings?.refForward === true,
  };
}

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
  const rules = referenceRules(settings);
  if (rules.mode !== "rules") normalized.references = rules.mode;
  if (rules.neighborColumns !== REF_NEIGHBOR_COLUMNS_DEFAULT) {
    normalized.refNeighborColumns = rules.neighborColumns;
  }
  if (rules.minKeep !== REF_MIN_KEEP_DEFAULT) normalized.refMinKeep = rules.minKeep;
  if (rules.forward) normalized.refForward = true;
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
    left?.nodeGap === right?.nodeGap &&
    left?.references === right?.references &&
    left?.refNeighborColumns === right?.refNeighborColumns &&
    left?.refMinKeep === right?.refMinKeep &&
    left?.refForward === right?.refForward
  );
}
