/**
 * P1 — column assignment.
 *
 * Each tier becomes one column, in tier order. Tiers with no nodes collapse rather than
 * leaving an empty gutter: a C4 context diagram using only `external` and `application`
 * should read as two adjacent columns, not two columns with three blanks between them.
 *
 * Column width is the widest node it holds, so a column of narrow nodes does not reserve
 * space for the widest node in the diagram.
 */

import { LAYOUT, SPACING } from "../constants";
import { cloneState, type LayoutColumn, type LayoutPass, type Tier } from "../types";

export const assignColumns: LayoutPass = (input) => {
  const state = cloneState(input);
  const { colGap } = SPACING[state.density];

  const byTier = new Map<Tier, string[]>();
  for (const node of state.nodes.values()) {
    const bucket = byTier.get(node.tier);
    if (bucket) bucket.push(node.id);
    else byTier.set(node.tier, [node.id]);
  }

  const columns: LayoutColumn[] = [];
  let cursorX: number = LAYOUT.ORIGIN_X;

  for (const tier of state.tiers) {
    const nodeIds = byTier.get(tier);
    // Empty tiers collapse — no column, no gap consumed.
    if (!nodeIds || nodeIds.length === 0) continue;

    const width = Math.max(...nodeIds.map((id) => state.nodes.get(id)?.width ?? LAYOUT.NODE_MIN_W));

    columns.push({ tier, x: cursorX, width, nodeIds });
    cursorX += width + colGap;
  }

  state.columns = columns;

  // Centre each node horizontally in its column, so a narrow node in a wide column does
  // not hug the left edge and produce visually ragged connections.
  for (const column of columns) {
    for (const id of column.nodeIds) {
      const node = state.nodes.get(id);
      if (!node) continue;
      node.x = Math.round(column.x + (column.width - node.width) / 2);
    }
  }

  return state;
};
