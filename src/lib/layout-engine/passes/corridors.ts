/**
 * P2b — routing corridors.
 *
 * A column layout puts a lone node at its column's vertical centre. When several consecutive
 * columns each hold one node, they all land on the same centre line — and an edge that skips
 * a column then runs straight through the node in between. Hexagonal component diagrams hit
 * this immediately: the domain fans out to a backend adapter and a data adapter, and the
 * edge to the farther one passes through the nearer.
 *
 * This pass finds edges that skip at least one column and nudges the blocking node off the
 * shared centre line by a routing corridor's width, so the edge has clear space to run
 * through. It moves the *blocker*, never an endpoint: moving an endpoint would change which
 * row the reader associates it with.
 *
 * The nudge is bounded and only applied when a node is actually blocking, so diagrams
 * without skip-edges are untouched.
 */

import { LAYOUT } from "../constants";
import { cloneState, type LayoutNode, type LayoutPass, type LayoutState } from "../types";

/** Vertical span shared by two nodes, as a fraction of the smaller one. */
function verticalOverlapRatio(a: LayoutNode, b: LayoutNode): number {
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const shared = bottom - top;
  if (shared <= 0) return 0;
  return shared / Math.min(a.height, b.height);
}

/** Column index per node, so "skips a column" is answerable. */
function columnIndexByNode(state: LayoutState): Map<string, number> {
  const index = new Map<string, number>();
  state.columns.forEach((column, position) => {
    for (const id of column.nodeIds) index.set(id, position);
  });
  return index;
}

export const openRoutingCorridors: LayoutPass = (input) => {
  const state = cloneState(input);
  if (state.columns.length < 3) return state;

  const columnOf = columnIndexByNode(state);

  // Nodes that sit alone in their column have room to move; a node sharing a column was
  // placed relative to its siblings and moving it would undo that.
  const isAlone = (nodeId: string): boolean => {
    const column = state.columns[columnOf.get(nodeId) ?? -1];
    return column ? column.nodeIds.length === 1 : false;
  };

  for (const connection of state.connections) {
    const source = state.nodes.get(connection.from);
    const target = state.nodes.get(connection.to);
    if (!source || !target) continue;
    if (source.tier === "cross-cutting" || target.tier === "cross-cutting") continue;

    const from = columnOf.get(source.id);
    const to = columnOf.get(target.id);
    if (from === undefined || to === undefined) continue;
    if (Math.abs(to - from) < 2) continue; // adjacent columns cannot be skipped over

    const low = Math.min(from, to);
    const high = Math.max(from, to);

    for (let position = low + 1; position < high; position += 1) {
      const column = state.columns[position];
      if (!column) continue;

      for (const blockerId of column.nodeIds) {
        const blocker = state.nodes.get(blockerId);
        if (!blocker) continue;
        if (blocker.id === source.id || blocker.id === target.id) continue;

        // Only a blocker sharing the endpoints' band is in the way.
        const inBand =
          verticalOverlapRatio(blocker, source) > 0.5 &&
          verticalOverlapRatio(blocker, target) > 0.5;
        if (!inBand) continue;
        if (!isAlone(blocker.id)) continue;

        // Move the blocker up out of the corridor. Up rather than down so the skipping edge
        // reads as passing below the main line, which matches the cross-cutting convention.
        blocker.y -= blocker.height / 2 + LAYOUT.ROUTING_CORRIDOR;
      }
    }
  }

  return state;
};
