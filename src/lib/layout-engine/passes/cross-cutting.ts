/**
 * P4 — cross-cutting band.
 *
 * Observability, auth and secrets touch nearly everything. Drawing those relationships turns
 * any diagram into a web, so cross-cutting services get their own band below the main flow
 * and no edges by default. That is a deliberate layout decision, not an omission.
 *
 * Placement wraps into rows of at most CROSS_CUTTING_PER_ROW, then resolves any residual
 * collision by iterative push-down (from event-modeling-tools): simple, deterministic, and
 * it converges because every step moves a box strictly downward.
 */

import { LAYOUT, SPACING } from "../constants";
import { cloneState, type LayoutNode, type LayoutPass } from "../types";

export const layoutCrossCutting: LayoutPass = (input) => {
  const state = cloneState(input);

  const crossCutting = [...state.nodes.values()].filter((node) => node.tier === "cross-cutting");
  if (crossCutting.length === 0) return state;

  const mainFlow = [...state.nodes.values()].filter((node) => node.tier !== "cross-cutting");

  // The band starts below everything else, including boundaries.
  let flowBottom: number = LAYOUT.ORIGIN_Y;
  for (const node of mainFlow) {
    flowBottom = Math.max(flowBottom, node.y + node.height);
  }
  for (const boundary of state.boundaries.values()) {
    flowBottom = Math.max(flowBottom, boundary.y + boundary.height);
  }

  const bandTop = flowBottom + LAYOUT.CROSS_CUTTING_GAP;
  const { colGap, rowGap } = SPACING[state.density];

  // Stable order so the band does not reshuffle between runs.
  const ordered = [...crossCutting].sort((a, b) => a.id.localeCompare(b.id));

  const placed: LayoutNode[] = [];
  let cursorX: number = LAYOUT.ORIGIN_X;
  let rowTop = bandTop;
  let rowHeight = 0;
  let inRow = 0;

  for (const node of ordered) {
    if (inRow >= LAYOUT.CROSS_CUTTING_PER_ROW) {
      rowTop += rowHeight + rowGap;
      cursorX = LAYOUT.ORIGIN_X;
      rowHeight = 0;
      inRow = 0;
    }

    node.x = cursorX;
    node.y = rowTop;

    pushDownUntilClear(node, placed, rowGap);

    placed.push(node);
    cursorX += node.width + colGap;
    rowHeight = Math.max(rowHeight, node.y + node.height - rowTop);
    inRow += 1;
  }

  return state;
};

/**
 * Pushes `node` down until it clears every already-placed box.
 *
 * Terminates because each iteration moves the node strictly downward past a box it
 * overlapped, and there are finitely many boxes.
 */
function pushDownUntilClear(node: LayoutNode, placed: readonly LayoutNode[], gap: number): void {
  let moved = true;
  while (moved) {
    moved = false;
    for (const other of placed) {
      const overlapsX = node.x < other.x + other.width && other.x < node.x + node.width;
      if (!overlapsX) continue;
      const overlapsY = node.y < other.y + other.height && other.y < node.y + node.height;
      if (!overlapsY) continue;

      node.y = other.y + other.height + gap;
      moved = true;
    }
  }
}
