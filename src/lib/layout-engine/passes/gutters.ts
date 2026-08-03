/**
 * P4 — sizes gutters between columns by channel demand, then reflows column x positions.
 *
 * A gutter is needed whenever an edge between adjacent columns is NOT vertically aligned
 * (the straight path from source to target would cut through another node). Edges between
 * non-adjacent columns or backward edges take a routing lane and do NOT consume gutter channels.
 *
 * Channel order is determined by the far endpoint's position — this is what keeps edges
 * from crossing each other inside the gutter.
 */
import {
  LAYOUT,
  SPACING,
  CHANNEL_PITCH,
  ALIGNMENT_TOLERANCE,
} from "../constants";
import { cloneState, type LayoutPass } from "../types";

export const sizeGutters: LayoutPass = (input) => {
  const state = cloneState(input);

  // ── Build lookup maps ─────────────────────────────────────────────────────────
  const columnOf = new Map<string, number>();
  state.columns.forEach((col, ci) => col.nodeIds.forEach((id) => columnOf.set(id, ci)));

  const nodeCenterY = (id: string) => {
    const n = state.nodes.get(id)!;
    return n.y + n.height / 2;
  };

  // ── Collect gutter demands ────────────────────────────────────────────────────
  // For each gutter g (between columns[g] and columns[g+1]), which edges cross it
  // and need a vertical channel?
  const gutterDemands = new Map<number, { connId: string; farY: number }[]>();

  for (const conn of state.connections) {
    const fromCol = columnOf.get(conn.from);
    const toCol = columnOf.get(conn.to);
    if (fromCol === undefined || toCol === undefined) continue;

    // Skip edges touching cross-cutting (handled by P6).
    const fromTier = state.nodes.get(conn.from)?.tier;
    const toTier = state.nodes.get(conn.to)?.tier;
    if (fromTier === "cross-cutting" || toTier === "cross-cutting") continue;

    const minCol = Math.min(fromCol, toCol);
    const maxCol = Math.max(fromCol, toCol);
    const isAdjacent = maxCol - minCol === 1;

    if (isAdjacent) {
      // Check alignment: edge goes straight if source and target are vertically aligned.
      const srcCenterY = nodeCenterY(conn.from);
      const tgtCenterY = nodeCenterY(conn.to);
      const aligned = Math.abs(srcCenterY - tgtCenterY) <= ALIGNMENT_TOLERANCE;

      if (!aligned) {
        // Needs a gutter channel.
        const gutterIdx = minCol; // gutter g sits between columns[g] and columns[g+1]
        const demands = gutterDemands.get(gutterIdx) ?? [];
        // Far endpoint determines channel slot: order by the position of the
        // endpoint in the far column (source if to is in the right column, target otherwise).
        const farY = toCol > fromCol ? nodeCenterY(conn.to) : nodeCenterY(conn.from);
        demands.push({ connId: conn.id, farY });
        gutterDemands.set(gutterIdx, demands);
      }
    }
    // Non-adjacent and backward edges take a lane, not a gutter channel.
  }

  // ── Sort channels by far-y ──────────────────────────────────────────────────
  for (const demands of gutterDemands.values()) {
    demands.sort((a, b) => a.farY - b.farY);
  }

  // ── Compute gutter widths ────────────────────────────────────────────────────
  const { colGap } = SPACING[state.density];
  const gutterWidths = new Map<number, number>();

  for (const [gIdx, demands] of gutterDemands) {
    const n = demands.length;
    const needed = 2 * LAYOUT.ARROWHEAD_CLEARANCE + n * CHANNEL_PITCH;
    gutterWidths.set(gIdx, Math.max(colGap, needed));
  }

  // ── Reflow column x positions ────────────────────────────────────────────────
  let cursorX = LAYOUT.ORIGIN_X;
  const newColumnXs: number[] = [];

  for (let ci = 0; ci < state.columns.length; ci += 1) {
    newColumnXs.push(cursorX);
    cursorX += state.columns[ci]!.width;
    // Add gutter width if there is a gutter after this column.
    if (gutterWidths.has(ci)) {
      cursorX += gutterWidths.get(ci)!;
    } else if (ci < state.columns.length - 1) {
      // No gutter but not the last column — add the default gap.
      cursorX += colGap;
    }
  }

  // Apply new x positions.
  state.columns.forEach((col, ci) => {
    col.x = newColumnXs[ci]!;
    // Recentre nodes within the column.
    for (const id of col.nodeIds) {
      const node = state.nodes.get(id);
      if (node) node.x = Math.round(col.x + (col.width - node.width) / 2);
    }
  });

  // ── Write gutters state ──────────────────────────────────────────────────────
  const gutters: ReturnType<typeof cloneState>["gutters"] = [];

  for (const [gIdx, demands] of gutterDemands) {
    const gutterWidth = gutterWidths.get(gIdx)!;
    // Left edge of gutter = right edge of columns[g].
    const gutterX = state.columns[gIdx]!.x + state.columns[gIdx]!.width;
    gutters.push({
      index: gIdx,
      x: gutterX,
      width: gutterWidth,
      channelEdgeIds: demands.map((d) => d.connId),
    });
  }

  state.gutters = gutters;

  return state;
};
