/**
 * P3 — converts column node order into vertical coordinates.
 *
 * The ordering is done by P2 (orderRows). This pass only:
 * - assigns y positions by walking down each column with rowGap
 * - vertically centres every column against the tallest
 *
 * Hub-centring was removed from here. A hub's high degree naturally places it near
 * the centre of its fan in the median heuristic of P2 — and without splitting the
 * primary path.
 *
 * Cross-cutting nodes are skipped here: P6 owns their band.
 */

import { LAYOUT, SPACING } from "../constants";
import { cloneState, type LayoutPass } from "../types";

export const stackRows: LayoutPass = (input) => {
  const state = cloneState(input);
  const { rowGap } = SPACING[state.density];

  const columnHeights: number[] = [];

  for (const column of state.columns) {
    // P6 owns the cross-cutting band.
    if (column.tier === "cross-cutting") {
      columnHeights.push(0);
      continue;
    }

    let cursorY = LAYOUT.ORIGIN_Y;
    for (const id of column.nodeIds) {
      const node = state.nodes.get(id);
      if (node) {
        node.y = cursorY;
        cursorY += node.height + rowGap;
      }
    }

    columnHeights.push(Math.max(0, cursorY - LAYOUT.ORIGIN_Y - rowGap));
  }

  // Centre every column against the tallest, so the diagram reads as a band
  // rather than a set of stacks all hanging from the top edge.
  const tallest = Math.max(0, ...columnHeights);
  for (let ci = 0; ci < state.columns.length; ci += 1) {
    const column = state.columns[ci]!;
    if (column.tier === "cross-cutting") continue;
    const offset = Math.round((tallest - columnHeights[ci]!) / 2);
    if (offset === 0) continue;
    for (const id of column.nodeIds) {
      const node = state.nodes.get(id);
      if (node) node.y += offset;
    }
  }

  return state;
};
