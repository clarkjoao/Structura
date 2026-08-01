/**
 * Single source of truth for the typography the layout engine measures with.
 *
 * The layout engine has to know how big a node will be *before* React Flow renders it.
 * That only works if the values used to measure text are the same ones the node's CSS
 * applies at render time. Keeping two parallel sets of numbers is the failure mode this
 * module exists to prevent: the engine would place boxes at one size, the canvas would
 * paint them at another, and every overlap/clearance/containment check downstream would
 * validate geometry the user never sees.
 *
 * Each entry below is annotated with the Tailwind class it mirrors and the file that
 * applies it. When the node CSS changes, these values change with it — the fixture test
 * in `measure.fixture.test.ts` fails loudly when the two drift apart.
 */

/** Font metrics for one run of text inside a node. */
export interface TextStyle {
  fontFamily: string;
  /** px */
  fontSize: number;
  /** CSS font-weight numeric value. */
  fontWeight: number;
  /** Multiplier applied to fontSize to get the line box height. */
  lineHeight: number;
  /** px added between characters; 0 for every current node style. */
  letterSpacing: number;
  /**
   * Hard cap on rendered lines, mirroring `truncate` (1) or `line-clamp-N` (N).
   * Text beyond this is clipped by CSS, so the measurer must not grow the box for it.
   */
  maxLines: number;
}

/**
 * Box model of a node's content area: the padding and inter-segment gaps its CSS applies.
 * Mirrors the `px-3 py-2.5` content wrapper and the `mb-1.5` gaps between segments.
 */
export interface NodeBoxModel {
  paddingX: number;
  paddingY: number;
  /** Vertical gap between two stacked text segments. */
  segmentGap: number;
  /** Width reserved left of the name for the type icon (`h-4 w-4` + `gap-2`). */
  iconWidth: number;
  /** CSS `min-width` of the node shell. */
  minWidth: number;
  /** CSS `max-width` of the node shell — text wraps/truncates rather than exceeding it. */
  maxWidth: number;
  /** Floor for the overall node height. */
  minHeight: number;
}

/** Typography for each text segment a measurable node can render. */
export interface NodeTypography {
  name: TextStyle;
  description: TextStyle;
  technology: TextStyle;
  box: NodeBoxModel;
}

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Typography of the standard `CustomNode` shell — the renderer behind C4 types
 * (person, system, container, component), every cloud type (aws, gcp, azure) and
 * `process-node` / `external-element`.
 *
 * Mirrors `src/features/canvas/nodes/CustomNode/index.tsx`:
 *   shell    `min-w-[200px] max-w-[260px]`
 *   content  `px-3 py-2.5`
 *   name     `text-sm font-bold leading-tight truncate`   → 14px/700, 1.25, 1 line
 *   desc     `text-xs leading-snug line-clamp-2 mb-1.5`   → 12px/400, 1.375, 2 lines
 *   tech     `text-[10px] font-mono px-1.5 py-0.5`        → 10px/400, badge
 *   icon row `h-4 w-4` + `gap-2` + `mb-1.5`
 */
export const CUSTOM_NODE_TYPOGRAPHY: NodeTypography = {
  name: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: 0,
    maxLines: 1,
  },
  description: {
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.375,
    letterSpacing: 0,
    maxLines: 2,
  },
  technology: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: 0,
    maxLines: 1,
  },
  box: {
    paddingX: 12,
    paddingY: 10,
    segmentGap: 6,
    iconWidth: 24,
    minWidth: 200,
    maxWidth: 260,
    minHeight: 60,
  },
};

/**
 * Extra vertical space the technology badge's own padding adds (`py-0.5` ×2 + border).
 */
export const TECHNOLOGY_BADGE_PADDING_Y = 4;

/** Horizontal padding inside the technology badge (`px-1.5` ×2). */
export const TECHNOLOGY_BADGE_PADDING_X = 12;
