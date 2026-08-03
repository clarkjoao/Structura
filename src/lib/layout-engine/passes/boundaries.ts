/**
 * P5 — boundary geometry.
 *
 * A boundary is the bounding box of its members plus padding and a title band. Nesting is
 * resolved innermost-first, so an outer boundary sees its children at their final size.
 *
 * Multi-tier boundaries (e.g. VPC spanning application + data tiers): when the nodes inside
 * a boundary span more than one tier, the boundary's horizontal extent covers all those tier
 * columns — not just the nodes. This mirrors how archify renders security-group boundaries.
 *
 * When a boundary grows, later siblings shift to make room — the cascading reflow from
 * event-modeling-tools. Growing a container without reflowing its siblings is what produces
 * the overlapping-group artefacts the reference implementations avoid; a boundary never
 * shrinks below its content.
 */

import { LAYOUT } from "../constants";
import {
  cloneState,
  type LayoutBoundary,
  type LayoutColumn,
  type LayoutPass,
  type LayoutState,
  type LayoutNode,
} from "../types";

/** Depth of each boundary, counted through `parentBoundaryId`. */
function computeDepths(state: LayoutState): void {
  const depthOf = (boundary: LayoutBoundary, seen: Set<string>): number => {
    if (!boundary.parentBoundaryId) return 0;
    // A cycle is a structural error the validators report; stop rather than recurse.
    if (seen.has(boundary.id)) return 0;
    const parent = state.boundaries.get(boundary.parentBoundaryId);
    if (!parent) return 0;
    seen.add(boundary.id);
    return depthOf(parent, seen) + 1;
  };

  for (const boundary of state.boundaries.values()) {
    boundary.depth = depthOf(boundary, new Set());
  }
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function emptyBox(): Box {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function extend(box: Box, x: number, y: number, width: number, height: number): void {
  box.minX = Math.min(box.minX, x);
  box.minY = Math.min(box.minY, y);
  box.maxX = Math.max(box.maxX, x + width);
  box.maxY = Math.max(box.maxY, y + height);
}

function isEmpty(box: Box): boolean {
  return box.minX === Infinity;
}

/**
 * Returns the tiers touched by a boundary's members, based on the columns map.
 * Only returns the tier indices that have an actual column (not empty tiers).
 */
function tiersForBoundary(
  boundary: LayoutBoundary,
  nodes: Map<string, LayoutNode>,
  columns: Map<string, { tierIndex: number }>,
): Set<number> {
  const tiers = new Set<number>();
  for (const nodeId of boundary.contains) {
    const node = nodes.get(nodeId);
    if (!node) continue;
    const col = columns.get(node.tier);
    if (col) tiers.add(col.tierIndex);
  }
  return tiers;
}

export const layoutBoundaries: LayoutPass = (input) => {
  const state = cloneState(input);
  if (state.boundaries.size === 0) return state;

  computeDepths(state);

  // Build a tier → column map for multi-tier boundary expansion.
  // state.columns may be empty if assignColumns hasn't run yet (e.g. direct call),
  // in which case we fall back to node-only bounding boxes.
  const tierToColumn = new Map<string, LayoutColumn>();
  for (const col of state.columns) {
    tierToColumn.set(col.tier, col);
  }

  // Innermost first: an outer boundary must see its children at final size.
  const ordered = [...state.boundaries.values()].sort((a, b) => b.depth - a.depth);

  const childBoundaries = new Map<string, LayoutBoundary[]>();
  for (const boundary of state.boundaries.values()) {
    if (!boundary.parentBoundaryId) continue;
    const siblings = childBoundaries.get(boundary.parentBoundaryId);
    if (siblings) siblings.push(boundary);
    else childBoundaries.set(boundary.parentBoundaryId, [boundary]);
  }

  for (const boundary of ordered) {
    const box = emptyBox();

    for (const nodeId of boundary.contains) {
      const node = state.nodes.get(nodeId);
      if (node) extend(box, node.x, node.y, node.width, node.height);
    }

    for (const child of childBoundaries.get(boundary.id) ?? []) {
      extend(box, child.x, child.y, child.width, child.height);
    }

    // Multi-tier boundaries: when members span more than one tier column, the boundary's
    // horizontal extent covers the full column range — not just the nodes inside.
    // This produces the archify security-group / VPC pattern where the boundary frame
    // visually spans multiple tiers.
    if (tierToColumn.size > 0 && box.minX !== Infinity) {
      const boundaryTiers = tiersForBoundary(boundary, state.nodes, tierToColumn);
      if (boundaryTiers.size > 1) {
        const sortedTiers = [...boundaryTiers].sort((a, b) => a - b);
        const firstCol = tierToColumn.get(state.columns[sortedTiers[0]!]!.tier);
        const lastCol = tierToColumn.get(state.columns[sortedTiers[sortedTiers.length - 1]!]!.tier);
        if (firstCol && lastCol) {
          box.minX = Math.min(box.minX, firstCol.x);
          box.maxX = Math.max(box.maxX, firstCol.x + firstCol.width);
          // Extend through all intermediate columns.
          for (let t = 1; t < sortedTiers.length; t++) {
            const col = tierToColumn.get(state.columns[sortedTiers[t]!]!.tier);
            if (col) box.maxX = Math.max(box.maxX, col.x + col.width);
          }
        }
      }
    }

    if (isEmpty(box)) {
      // Empty boundaries are reported by the validators; give it a minimal placeholder
      // rather than an infinite rect.
      boundary.x = LAYOUT.ORIGIN_X;
      boundary.y = LAYOUT.ORIGIN_Y;
      boundary.width = LAYOUT.NODE_MIN_W;
      boundary.height = LAYOUT.NODE_MIN_H + LAYOUT.BOUNDARY_TITLE_BAND;
      continue;
    }

    boundary.x = box.minX - LAYOUT.BOUNDARY_PADDING;
    boundary.y = box.minY - LAYOUT.BOUNDARY_PADDING - LAYOUT.BOUNDARY_TITLE_BAND;
    boundary.width = box.maxX - box.minX + LAYOUT.BOUNDARY_PADDING * 2;
    boundary.height =
      box.maxY - box.minY + LAYOUT.BOUNDARY_PADDING * 2 + LAYOUT.BOUNDARY_TITLE_BAND;
  }

  reflowSiblings(state, childBoundaries);

  return state;
};

/**
 * Cascading reflow: within each parent, siblings are laid out in order and each one shifts
 * to clear the previous. Without this, a boundary that grew to fit its content overlaps the
 * next one along.
 */
function reflowSiblings(
  state: LayoutState,
  childBoundaries: ReadonlyMap<string, LayoutBoundary[]>,
): void {
  const topLevel = [...state.boundaries.values()].filter((b) => !b.parentBoundaryId);
  reflowGroup(state, topLevel, childBoundaries);

  for (const siblings of childBoundaries.values()) {
    reflowGroup(state, siblings, childBoundaries);
  }
}

function reflowGroup(
  state: LayoutState,
  siblings: LayoutBoundary[],
  childBoundaries: ReadonlyMap<string, LayoutBoundary[]>,
): void {
  if (siblings.length < 2) return;

  const ordered = [...siblings].sort((a, b) => {
    if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
      return a.orderIndex - b.orderIndex;
    }
    if (a.orderIndex !== undefined) return -1;
    if (b.orderIndex !== undefined) return 1;
    // Fall back to laid-out position, then id, so the order is total.
    if (a.y !== b.y) return a.y - b.y;
    return a.id.localeCompare(b.id);
  });

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1]!;
    const current = ordered[i]!;

    // Only reflow when they actually collide: boundaries in different columns are
    // horizontally separated and must not be stacked vertically for no reason.
    const overlapsHorizontally =
      current.x < previous.x + previous.width && previous.x < current.x + current.width;
    if (!overlapsHorizontally) continue;

    const requiredY = previous.y + previous.height + LAYOUT.BOUNDARY_PADDING;
    if (current.y >= requiredY) continue;

    shiftBoundary(state, current, requiredY - current.y, childBoundaries);
  }
}

/** Moves a boundary and everything inside it by `dy`. */
function shiftBoundary(
  state: LayoutState,
  boundary: LayoutBoundary,
  dy: number,
  childBoundaries: ReadonlyMap<string, LayoutBoundary[]>,
): void {
  boundary.y += dy;

  for (const nodeId of boundary.contains) {
    const node: LayoutNode | undefined = state.nodes.get(nodeId);
    if (node) node.y += dy;
  }

  for (const child of childBoundaries.get(boundary.id) ?? []) {
    shiftBoundary(state, child, dy, childBoundaries);
  }
}
