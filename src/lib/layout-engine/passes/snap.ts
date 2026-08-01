/**
 * P6 — grid snap.
 *
 * Runs last, once, on final geometry. Snapping between passes would let rounding error
 * accumulate: each pass would round its input, and a later pass would round that again.
 * Node sizes are left alone — those come from measurement and must keep matching what the
 * browser renders.
 */

import { snapToGrid } from "../constants";
import { cloneState, type LayoutPass } from "../types";

export const snapGeometry: LayoutPass = (input) => {
  const state = cloneState(input);

  for (const node of state.nodes.values()) {
    node.x = snapToGrid(node.x);
    node.y = snapToGrid(node.y);
  }

  for (const boundary of state.boundaries.values()) {
    // Snap the edges, not the extents: rounding origin and size independently can shrink a
    // boundary below the content it must enclose.
    const right = boundary.x + boundary.width;
    const bottom = boundary.y + boundary.height;
    const snappedX = snapToGrid(boundary.x);
    const snappedY = snapToGrid(boundary.y);
    boundary.x = snappedX;
    boundary.y = snappedY;
    boundary.width = Math.ceil(right - snappedX);
    boundary.height = Math.ceil(bottom - snappedY);
  }

  for (const column of state.columns) {
    column.x = snapToGrid(column.x);
  }

  return state;
};
