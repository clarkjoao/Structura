/**
 * Layout constants.
 *
 * Values are recalibrated for the React Flow canvas from the conventions in the reference
 * repos (see the architecture proposal). Where a number here would contradict what the node
 * CSS actually renders, the CSS wins and the divergence is documented — the engine placing
 * boxes at sizes the browser cannot paint is the exact failure the measurement pass exists
 * to prevent.
 */

import { CUSTOM_NODE_TYPOGRAPHY } from "./typography";

/** Density buckets. The elicitation phase sets this; the engine scales spacing by it. */
export type DensityHint = "simple" | "medium" | "complex";

/**
 * Spacing scales with node count rather than staying constant: a five-node context diagram
 * reads as sparse at the gaps a twenty-node diagram needs to stay untangled.
 */
export const SPACING: Record<DensityHint, { colGap: number; rowGap: number }> = {
  simple: { colGap: 200, rowGap: 150 }, // <= 5 nodes
  medium: { colGap: 280, rowGap: 200 }, // 6-10 nodes
  complex: { colGap: 350, rowGap: 250 }, // > 10 nodes
};

/** Node-count thresholds that select a density bucket when none was supplied. */
export const DENSITY_THRESHOLDS = { simple: 5, medium: 10 } as const;

/** Picks the density bucket for a node count. */
export function densityForNodeCount(count: number): DensityHint {
  if (count <= DENSITY_THRESHOLDS.simple) return "simple";
  if (count <= DENSITY_THRESHOLDS.medium) return "medium";
  return "complex";
}

export const LAYOUT = {
  /** Final snap. Applied last so intermediate passes don't accumulate rounding error. */
  GRID: 10,

  /**
   * Empty band between rows/columns reserved for edge routing. Nothing may be placed in a
   * corridor an edge needs to traverse.
   */
  ROUTING_CORRIDOR: 80,

  /**
   * Minimum length of an edge's final straight segment. Below this the arrowhead collides
   * with the last bend and reads as broken.
   */
  ARROWHEAD_CLEARANCE: 20,

  /** Inner margin between a boundary's border and its children. */
  BOUNDARY_PADDING: 30,
  /** Title band at the top of a boundary, above the content area. */
  BOUNDARY_TITLE_BAND: 30,

  /** Vertical separation between the main flow and the cross-cutting band. */
  CROSS_CUTTING_GAP: 120,
  /** Cross-cutting services wrap into rows of at most this many. */
  CROSS_CUTTING_PER_ROW: 7,

  /**
   * Edge anchors are clamped into this fraction of a node's side, so an anchor never lands
   * exactly on a corner where the arrow would read as detached.
   */
  ANCHOR_CLAMP: [0.05, 0.95] as const,

  /**
   * Node size bounds.
   *
   * These mirror `CustomNode`'s own `min-w-[200px] max-w-[260px]` rather than the wider
   * 160/320 range in the original plan: the shell CSS clamps rendered width to its own
   * bounds, so measuring outside them would place boxes at a size the browser will not
   * paint. Widening the range is a CSS change first, a constants change second.
   */
  NODE_MIN_W: CUSTOM_NODE_TYPOGRAPHY.box.minWidth,
  NODE_MAX_W: CUSTOM_NODE_TYPOGRAPHY.box.maxWidth,
  NODE_MIN_H: CUSTOM_NODE_TYPOGRAPHY.box.minHeight,
  /** Ceiling for a label-driven node; intrinsic-size types are exempt. */
  NODE_MAX_H: 220,
  NODE_PADDING: CUSTOM_NODE_TYPOGRAPHY.box.paddingX,

  /** Top-left origin of the laid-out diagram in flow coordinates. */
  ORIGIN_X: 40,
  ORIGIN_Y: 40,
} as const;

/** Number of median sweeps in the crossing-reduction pass (P2). Gains saturate after ~4. */
export const MAX_ORDERING_SWEEPS = 4;

/** Vertical pitch between adjacent channels inside a gutter. */
export const CHANNEL_PITCH = 16;

/** Vertical pitch between adjacent horizontal routing lanes.
 * Must be >= ARROWHEAD_CLEARANCE so two adjacent lanes in the same gutter are
 * visually distinguishable (avoids false edge/stacked positives). */
export const LANE_PITCH = 40;

/** Gap between the main flow and the first routing lane above/below it. */
export const LANE_GAP = 40;

/** Vertical misalignment tolerance for a direct edge to bypass the gutter channel. */
export const ALIGNMENT_TOLERANCE = 8;

/**
 * Semantic palette — fill/stroke pairs by role.
 * Applied when a node carries no explicit colour of its own.
 */
export interface PaletteEntry {
  fill: string;
  stroke: string;
}

export const SEMANTIC_PALETTE = {
  service: { fill: "#dae8fc", stroke: "#6c8ebf" },
  data: { fill: "#d5e8d4", stroke: "#82b366" },
  queue: { fill: "#fff2cc", stroke: "#d6b656" },
  gateway: { fill: "#ffe6cc", stroke: "#d79b00" },
  alert: { fill: "#f8cecc", stroke: "#b85450" },
  external: { fill: "#f5f5f5", stroke: "#666666" },
  security: { fill: "#e1d5e7", stroke: "#9673a6" },
} as const satisfies Record<string, PaletteEntry>;

export type SemanticRole = keyof typeof SEMANTIC_PALETTE;

/**
 * Official C4 element colours and canonical sizes.
 *
 * Sizes are the C4 reference dimensions, kept for export targets that honour them. The
 * React Flow canvas sizes label-driven nodes by measurement instead (see `measure.ts`),
 * so these are reference values, not what the canvas renders.
 */
export const C4_STYLE = {
  person: { fill: "#083F75", stroke: "#06315C", width: 200, height: 180 },
  system: { fill: "#1061B0", stroke: "#0D5091", width: 240, height: 120 },
  "external-system": { fill: "#8C8496", stroke: "#736782", width: 240, height: 120 },
  container: { fill: "#23A2D9", stroke: "#0E7DAD", width: 240, height: 120 },
  component: { fill: "#63BEF2", stroke: "#2086C9", width: 240, height: 120 },
} as const;

export type C4StyleKey = keyof typeof C4_STYLE;

/**
 * Composition limit from the archify invariants: past roughly a dozen primary elements a
 * diagram stops being readable at a glance and should be split by level instead.
 */
export const MAX_PRIMARY_NODES = 12;

/** Label mask geometry, used for edge-label clearance checks. */
export const LABEL_MASK = {
  /** Approximate advance per ASCII unit, in px. */
  PX_PER_UNIT: 6.5,
  /** Fixed padding added to every mask. */
  PADDING: 13,
  /** Clear gap a label needs beyond its own mask width. */
  BREATHING_ROOM: 8,
} as const;

/** Width of the mask an edge label occupies. CJK characters count as two units. */
export function labelMaskWidth(label: string): number {
  let units = 0;
  for (const char of label) {
    // Rough CJK / fullwidth ranges — these render at roughly double ASCII advance.
    units += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠]/.test(char) ? 2 : 1;
  }
  return units * LABEL_MASK.PX_PER_UNIT + LABEL_MASK.PADDING;
}

/** Snaps a value to the layout grid. */
export function snapToGrid(value: number, grid: number = LAYOUT.GRID): number {
  return Math.round(value / grid) * grid;
}
