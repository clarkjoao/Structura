/**
 * P2 — vertical stacking within a column.
 *
 * Two rules shape the order:
 *
 * 1. Primary-path nodes come first, in path order. Aligning the happy path across columns
 *    is what lets a reader follow the diagram in one pass — the path is the diagram's
 *    spine, not just an emphasis style.
 *
 * 2. Hub nodes (a bus, queue or event router: high degree, mostly async traffic) are pulled
 *    to the vertical centre of their column. Peers on both sides then reach them with short
 *    horizontal arrows instead of long diagonals, which is what removes most crossings in
 *    event-driven diagrams.
 *
 * Cross-cutting nodes are skipped here: P4 owns their band.
 */

import { LAYOUT, SPACING } from "../constants";
import { cloneState, type LayoutNode, type LayoutPass, type LayoutState } from "../types";

/** Degree at which a node is dense enough to be worth centring as a hub. */
const HUB_MIN_DEGREE = 4;

/** Share of a node's connections that must be async for it to read as a bus. */
const HUB_ASYNC_RATIO = 0.5;

function degreeOf(state: LayoutState): Map<string, { total: number; async: number }> {
  const degree = new Map<string, { total: number; async: number }>();

  const bump = (id: string, isAsync: boolean) => {
    const entry = degree.get(id) ?? { total: 0, async: 0 };
    entry.total += 1;
    if (isAsync) entry.async += 1;
    degree.set(id, entry);
  };

  for (const connection of state.connections) {
    const isAsync = connection.intent === "async-message" || connection.intent === "event";
    bump(connection.from, isAsync);
    bump(connection.to, isAsync);
  }

  return degree;
}

/** A hub carries enough traffic, and enough of it asynchronous, to sit at the centre. */
export function isHubNode(
  nodeId: string,
  degree: ReadonlyMap<string, { total: number; async: number }>,
): boolean {
  const entry = degree.get(nodeId);
  if (!entry || entry.total < HUB_MIN_DEGREE) return false;
  return entry.async / entry.total >= HUB_ASYNC_RATIO;
}

export const stackColumns: LayoutPass = (input) => {
  const state = cloneState(input);
  const { rowGap } = SPACING[state.density];
  const degree = degreeOf(state);

  const pathIndex = new Map<string, number>();
  state.primaryPath.forEach((id, index) => pathIndex.set(id, index));

  // Lay out each column independently, then centre them against the tallest.
  const columnHeights: number[] = [];

  for (const column of state.columns) {
    // P4 owns the cross-cutting band; leave those nodes for it.
    if (column.tier === "cross-cutting") {
      columnHeights.push(0);
      continue;
    }

    const nodes = column.nodeIds
      .map((id) => state.nodes.get(id))
      .filter((node): node is LayoutNode => node !== undefined);

    const hubs = nodes.filter((node) => isHubNode(node.id, degree));
    const rest = nodes.filter((node) => !isHubNode(node.id, degree));

    // Primary-path nodes first in path order, then everything else alphabetically so the
    // result is stable for any input ordering.
    rest.sort((a, b) => {
      const ia = pathIndex.get(a.id);
      const ib = pathIndex.get(b.id);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return a.id.localeCompare(b.id);
    });

    // A hub sits in the middle of the column, with the remaining nodes split around it.
    let ordered: LayoutNode[];
    if (hubs.length > 0) {
      const half = Math.ceil(rest.length / 2);
      ordered = [...rest.slice(0, half), ...hubs, ...rest.slice(half)];
    } else {
      ordered = rest;
    }

    let cursorY = LAYOUT.ORIGIN_Y;
    for (const node of ordered) {
      node.y = cursorY;
      cursorY += node.height + rowGap;
    }

    // Height of the laid-out stack, without the trailing gap.
    columnHeights.push(Math.max(0, cursorY - LAYOUT.ORIGIN_Y - rowGap));
    column.nodeIds = ordered.map((node) => node.id);
  }

  // Vertically centre every column against the tallest, so the diagram reads as a band
  // rather than a set of stacks all hanging from the top edge.
  const tallest = Math.max(0, ...columnHeights);
  state.columns.forEach((column, index) => {
    if (column.tier === "cross-cutting") return;
    const offset = Math.round((tallest - columnHeights[index]!) / 2);
    if (offset === 0) return;
    for (const id of column.nodeIds) {
      const node = state.nodes.get(id);
      if (node) node.y += offset;
    }
  });

  return state;
};
