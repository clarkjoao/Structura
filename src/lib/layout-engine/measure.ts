/**
 * P0 — node measurement.
 *
 * The layout engine needs each node's size before it can place anything. React Flow only
 * knows the real size after render, so the engine measures the text itself, using the same
 * typography the node CSS applies (see `typography.ts`).
 *
 * Text measurement is injected (`MeasureText`) rather than reached for globally: the engine
 * stays pure and runs headless in Vitest, where no canvas exists. The browser passes a
 * canvas-backed measurer; tests pass a deterministic approximation.
 */

import type { ComponentType } from "@/features/diagram";
import { CUSTOM_NODE_TYPOGRAPHY, TECHNOLOGY_BADGE_PADDING_X } from "./typography";
import type { NodeTypography, TextStyle } from "./typography";

/**
 * Measures the advance width of a single-line string in the given style.
 * Implementations must be pure with respect to the arguments.
 */
export type MeasureText = (text: string, style: TextStyle) => number;

export interface MeasurableNode {
  id: string;
  type: ComponentType;
  name: string;
  technology?: string;
  description?: string;
}

export interface NodeSize {
  width: number;
  height: number;
}

/** A node whose size the label text cannot determine. */
export interface IntrinsicSizeSource {
  /** Descriptor `defaultSize`, used as the floor. */
  defaultSize?: NodeSize;
  /** Size implied by the node's own content (table rows, JSON tree, panel children). */
  contentSize?: NodeSize;
}

/**
 * Node types whose height comes from their content, not from a text label.
 *
 * - `panel` is a container: its size follows its children (resolved by the boundary pass).
 * - `db-table` grows one row per column.
 * - `json-viewer` grows with the JSON tree it displays.
 * - `api-group` grows one row per endpoint.
 * - `note` is a free-form sticky sized by the user.
 * - `svg` renders artwork at its own aspect ratio.
 *
 * For these the label formula is skipped entirely; `measureIntrinsicNode` applies
 * `defaultSize` as a floor and lets real content grow the box beyond it.
 */
export const INTRINSIC_SIZE_TYPES: ReadonlySet<string> = new Set([
  "panel",
  "db-table",
  "json-viewer",
  "api-group",
  "note",
  "svg",
]);

export function hasIntrinsicSize(type: ComponentType): boolean {
  return INTRINSIC_SIZE_TYPES.has(type);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Height of a text run once wrapped into the available width.
 *
 * CSS caps the rendered line count (`truncate` = 1, `line-clamp-2` = 2), so overflow is
 * clipped rather than growing the box — the measurer must reproduce that cap, otherwise it
 * over-estimates height for long descriptions and the engine leaves dead space.
 */
function measureWrappedHeight(
  text: string,
  style: TextStyle,
  availableWidth: number,
  measureText: MeasureText,
): number {
  if (!text) return 0;
  const singleLineWidth = measureText(text, style);
  const neededLines = availableWidth > 0 ? Math.ceil(singleLineWidth / availableWidth) : 1;
  const lines = clamp(neededLines, 1, style.maxLines);
  return Math.round(lines * style.fontSize * style.lineHeight);
}

/**
 * Measures a label-driven node.
 *
 * Width is driven by the widest segment, clamped to the shell's CSS `min-width`/`max-width`
 * — the node can never render outside those bounds, so neither may the measurement.
 * Height is the sum of the rendered segments plus padding and inter-segment gaps.
 */
export function measureLabelNode(
  node: MeasurableNode,
  measureText: MeasureText,
  typography: NodeTypography = CUSTOM_NODE_TYPOGRAPHY,
): NodeSize {
  const { name, description, technology, box } = typography;

  // The name sits in a flex row after the icon, so the icon eats into its available width.
  const nameWidth = measureText(node.name, name) + box.iconWidth;
  const descriptionWidth = node.description ? measureText(node.description, description) : 0;
  const technologyWidth = node.technology
    ? measureText(node.technology, technology) + TECHNOLOGY_BADGE_PADDING_X
    : 0;

  const widestSegment = Math.max(nameWidth, descriptionWidth, technologyWidth);
  const width = clamp(Math.round(widestSegment + box.paddingX * 2), box.minWidth, box.maxWidth);

  const contentWidth = width - box.paddingX * 2;

  let height = box.paddingY * 2;
  height += measureWrappedHeight(node.name, name, contentWidth - box.iconWidth, measureText);

  if (node.description) {
    height += box.segmentGap;
    height += measureWrappedHeight(node.description, description, contentWidth, measureText);
  }

  if (node.technology) {
    height += box.segmentGap;
    height += measureWrappedHeight(node.technology, technology, contentWidth, measureText);
  }

  return { width, height: Math.max(Math.round(height), box.minHeight) };
}

/**
 * Sizes a node whose dimensions come from its content rather than a text label.
 * `defaultSize` is the floor, never the answer: real content grows the box past it.
 */
export function measureIntrinsicNode(
  source: IntrinsicSizeSource,
  typography: NodeTypography = CUSTOM_NODE_TYPOGRAPHY,
): NodeSize {
  const floorWidth = source.defaultSize?.width ?? typography.box.minWidth;
  const floorHeight = source.defaultSize?.height ?? typography.box.minHeight;

  return {
    width: Math.round(Math.max(floorWidth, source.contentSize?.width ?? 0)),
    height: Math.round(Math.max(floorHeight, source.contentSize?.height ?? 0)),
  };
}

export interface MeasureNodeOptions {
  measureText: MeasureText;
  /** Descriptor `defaultSize` per node type, for intrinsic-size nodes. */
  defaultSizeFor?: (type: ComponentType) => NodeSize | undefined;
  /** Content-derived size per node id, for intrinsic-size nodes. */
  contentSizeFor?: (nodeId: string) => NodeSize | undefined;
  typography?: NodeTypography;
}

/** Measures one node, routing to the label or intrinsic strategy by type. */
export function measureNode(node: MeasurableNode, options: MeasureNodeOptions): NodeSize {
  const typography = options.typography ?? CUSTOM_NODE_TYPOGRAPHY;

  if (hasIntrinsicSize(node.type)) {
    return measureIntrinsicNode(
      {
        defaultSize: options.defaultSizeFor?.(node.type),
        contentSize: options.contentSizeFor?.(node.id),
      },
      typography,
    );
  }

  return measureLabelNode(node, options.measureText, typography);
}

/** Measures every node, keyed by node id. */
export function measureNodes(
  nodes: readonly MeasurableNode[],
  options: MeasureNodeOptions,
): Map<string, NodeSize> {
  const sizes = new Map<string, NodeSize>();
  for (const node of nodes) {
    sizes.set(node.id, measureNode(node, options));
  }
  return sizes;
}
