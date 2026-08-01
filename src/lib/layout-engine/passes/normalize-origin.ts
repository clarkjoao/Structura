/**
 * P5b — origin normalisation.
 *
 * Boundaries are drawn above and to the left of their contents: padding on every side plus a
 * title band on top. A boundary wrapping the first column therefore starts at a negative
 * coordinate, and each level of nesting pushes further out — four levels reaches roughly
 * (-80, -200). The diagram would open partly above and left of where the canvas viewport
 * starts.
 *
 * So after boundaries and the cross-cutting band are placed, the whole diagram is translated
 * so its top-left sits at the configured origin. This is a rigid translation: every relative
 * position, and therefore every edge anchor, is unchanged.
 *
 * Runs before the grid snap so the shift cannot leave anything off-grid.
 */

import { LAYOUT } from "../constants";
import { cloneState, type LayoutPass } from "../types";

export const normalizeOrigin: LayoutPass = (input) => {
  const state = cloneState(input);

  let minX = Infinity;
  let minY = Infinity;

  for (const node of state.nodes.values()) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
  }
  for (const boundary of state.boundaries.values()) {
    minX = Math.min(minX, boundary.x);
    minY = Math.min(minY, boundary.y);
  }

  // Nothing placed yet: leave it alone rather than translating by Infinity.
  if (minX === Infinity || minY === Infinity) return state;

  const dx = LAYOUT.ORIGIN_X - minX;
  const dy = LAYOUT.ORIGIN_Y - minY;
  if (dx === 0 && dy === 0) return state;

  for (const node of state.nodes.values()) {
    node.x += dx;
    node.y += dy;
  }
  for (const boundary of state.boundaries.values()) {
    boundary.x += dx;
    boundary.y += dy;
  }
  for (const column of state.columns) {
    column.x += dx;
  }

  return state;
};
