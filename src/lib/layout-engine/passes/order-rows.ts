/**
 * P2 — row ordering within columns by crossing reduction.
 *
 * Placement before position: this pass decides *which* node goes in *which* row,
 * without touching x or y. The stack pass (P3) converts the resulting order into
 * vertical coordinates.
 *
 * Algorithm — Sugiyama-style median heuristic:
 *
 * 1. Cluster nodes that must move as a unit:
 *    - members of the same boundary (contiguity is what makes boundary boxes drawable)
 *    - primary-path nodes that fall in the same column (path order is preserved within)
 *    A node in both groups joins the boundary cluster; path order applies inside it.
 *
 * 2. Run up to MAX_ORDERING_SWEEPS alternating forward / backward:
 *    - forward: position of each cluster = median of its neighbors' positions in the
 *      previous column; clusters with no neighbor in that column keep relative position
 *    - backward: mirror, looking at the next column
 *    - after each sweep, count total crossings; keep the best ordering seen
 *
 * 3. Within each cluster, apply the sub-order: path order for path nodes, or
 *    median-of-neighbors for boundary members.
 *
 * The hub-centring logic removed from the old stacking.ts is NOT restored here.
 * A hub's high degree naturally places it near the centre of its fan in the median —
 * and without splitting the primary path.
 */

import { MAX_ORDERING_SWEEPS } from "../constants";
import { cloneState, type LayoutColumn, type LayoutPass, type LayoutState } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A group of nodes that moves as a unit during ordering. */
interface Cluster {
  nodeIds: string[];
  /** Boundary that owns these nodes, if any. */
  boundaryId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Position of each node within its column (0 = top). */
type PositionMap = Map<string, number>;

/** Builds a position map from the current column order. */
function buildPositionMap(state: LayoutState): PositionMap {
  const map = new Map<string, number>();
  for (const column of state.columns) {
    column.nodeIds.forEach((id, index) => map.set(id, index));
  }
  return map;
}

/** Maps node ID → column index. */
function buildColumnOf(state: LayoutState): Map<string, number> {
  const map = new Map<string, number>();
  state.columns.forEach((col, index) => {
    for (const id of col.nodeIds) map.set(id, index);
  });
  return map;
}

// ─── Cluster formation ────────────────────────────────────────────────────────

/**
 * Groups nodes that must move as a unit.
 *
 * Priority: boundary membership > primary-path order.
 * A node that belongs to both a boundary and the primary path joins the boundary cluster;
 * path order is applied inside it.
 */
function buildClusters(state: LayoutState): Map<string, Cluster> {
  const clusters = new Map<string, Cluster>();

  // Boundary clusters: one per boundary, containing its members.
  for (const boundary of state.boundaries.values()) {
    if (boundary.contains.length === 0) continue;
    const cluster: Cluster = { nodeIds: [...boundary.contains], boundaryId: boundary.id };
    for (const id of boundary.contains) clusters.set(id, cluster);
  }

  // Primary-path clusters: nodes of the same path segment that fall in one column.
  const pathIndex = new Map<string, number>();
  state.primaryPath.forEach((id, index) => pathIndex.set(id, index));

  for (const column of state.columns) {
    const pathNodes = column.nodeIds
      .map((id) => ({ id, pathPos: pathIndex.get(id) }))
      .filter((n): n is { id: string; pathPos: number } => n.pathPos !== undefined);

    // Group consecutive path nodes in the same column.
    for (let i = 0; i < pathNodes.length; i += 1) {
      const start = i;
      // Find consecutive run.
      while (
        i + 1 < pathNodes.length &&
        pathNodes[i + 1]!.pathPos === pathNodes[i]!.pathPos + 1
      ) {
        i += 1;
      }
      const end = i;
      if (end > start) {
        const ids = pathNodes.slice(start, end + 1).map((n) => n.id);
        for (const id of ids) {
          // If already in a boundary cluster, don't move it out.
          if (!clusters.has(id)) {
            clusters.set(id, { nodeIds: ids });
          }
        }
      }
    }
  }

  // Remaining singletons.
  for (const node of state.nodes.values()) {
    if (!clusters.has(node.id)) {
      clusters.set(node.id, { nodeIds: [node.id] });
    }
  }

  return clusters;
}

// ─── Median position ───────────────────────────────────────────────────────────

/** Median of an array of numbers; keeps relative order on tie (stable). */
function medianPosition(positions: number[]): number {
  if (positions.length === 0) return -1;
  const sorted = [...positions].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ─── Crossing count ────────────────────────────────────────────────────────────

/**
 * Total edge crossings in the diagram, summed over all adjacent-column pairs.
 *
 * For a pair of edges (u1→v1), (u2→v2) between the same two columns:
 * they cross iff (pos(u1) - pos(u2)) * (pos(v1) - pos(v2)) < 0.
 *
 * O(E²) per pair is fine here — real diagrams have ≤20 edges in the same
 * column pair, so O(400) is negligible compared to the sweep cost.
 */
export function countCrossings(state: LayoutState): number {
  const columnOf = buildColumnOf(state);
  const pos = buildPositionMap(state);
  let total = 0;

  for (let ci = 0; ci < state.columns.length - 1; ci += 1) {
    // Collect edges between these two columns.
    const ab: Array<{ from: string; to: string; fromPos: number; toPos: number }> = [];
    for (const conn of state.connections) {
      const fromCol = columnOf.get(conn.from);
      const toCol = columnOf.get(conn.to);
      if (fromCol === ci && toCol === ci + 1) {
        const fp = pos.get(conn.from);
        const tp = pos.get(conn.to);
        if (fp !== undefined && tp !== undefined) {
          ab.push({ from: conn.from, to: conn.to, fromPos: fp, toPos: tp });
        }
      }
    }

    // Count crossings: all pairs of edges between these columns.
    for (let i = 0; i < ab.length; i += 1) {
      for (let j = i + 1; j < ab.length; j += 1) {
        const a = ab[i]!;
        const b = ab[j]!;
        if ((a.fromPos - b.fromPos) * (a.toPos - b.toPos) < 0) {
          total += 1;
        }
      }
    }
  }

  return total;
}

// ─── Cluster ordering ─────────────────────────────────────────────────────────

/**
 * Orders clusters within a column by the median of their neighbors' positions in
 * the reference column (forward sweep) or next column (backward sweep).
 *
 * Nodes without a neighbour in the reference column keep their relative position.
 * Ties broken by the first member's id for determinism.
 */
function orderClustersByMedian(
  state: LayoutState,
  columnIndex: number,
  clusters: Map<string, Cluster>,
  direction: "forward" | "backward",
): string[] {
  const pos = buildPositionMap(state);
  const columnOf = buildColumnOf(state);

  const refColumnIndex = direction === "forward" ? columnIndex - 1 : columnIndex + 1;
  const refColumn = state.columns[refColumnIndex];
  if (!refColumn) {
    // First or last column — no reference. Return current order.
    return [...state.columns[columnIndex]!.nodeIds];
  }

  // Cluster → median position in reference column.
  const clusterMedian = new Map<Cluster, number>();
  for (const cluster of new Set(clusters.values())) {
    const refPositions: number[] = [];
    for (const id of cluster.nodeIds) {
      // Find neighbors of this node in the reference column (edges to/from ref column).
      for (const conn of state.connections) {
        const otherId = conn.from === id ? conn.to : conn.from === id ? conn.from : undefined;
        if (!otherId) continue;
        if (columnOf.get(otherId) === refColumnIndex) {
          const p = pos.get(otherId);
          if (p !== undefined) refPositions.push(p);
        }
      }
    }
    const med = medianPosition(refPositions);
    clusterMedian.set(cluster, med);
  }

  // Separate clusters with a known median from those with none.
  const anchored: Array<{ cluster: Cluster; median: number }> = [];
  const floating: Cluster[] = [];

  const col = state.columns[columnIndex]!;
  for (const id of col.nodeIds) {
    const cluster = clusters.get(id)!;
    const med = clusterMedian.get(cluster) ?? -1;
    if (med >= 0) {
      if (!anchored.some((a) => a.cluster === cluster)) {
        anchored.push({ cluster, median: med });
      }
    } else {
      if (!floating.includes(cluster)) {
        floating.push(cluster);
      }
    }
  }

  // Sort anchored by median, then by first member id.
  anchored.sort((a, b) => {
    if (a.median !== b.median) return a.median - b.median;
    return a.cluster.nodeIds[0]!.localeCompare(b.cluster.nodeIds[0]!);
  });

  // Append floating in alphabetical order for determinism — not iteration order.
  // This matches the old stacking.ts behaviour and prevents spurious re-ordering
  // when two floating nodes share the same median (e.g. both connect to the same
  // target in the next column).
  const floatingOrder = col.nodeIds
    .filter((id) => !clusterMedian.has(clusters.get(id)!))
    .sort((a, b) => a.localeCompare(b));

  // Build final order: anchored clusters first, then floating.
  const result: string[] = [];
  for (const { cluster } of anchored) {
    result.push(...cluster.nodeIds);
  }
  for (const id of floatingOrder) {
    result.push(id);
  }

  return result;
}

// ─── Within-cluster ordering ──────────────────────────────────────────────────

/** Orders nodes inside one cluster using path order or median. */
function orderInsideCluster(
  nodeIds: string[],
  pathIndex: Map<string, number>,
  state: LayoutState,
  columnOf: Map<string, number>,
): string[] {
  // All in same column?
  const cols = nodeIds.map((id) => columnOf.get(id));
  const allSame = cols.every((c) => c === cols[0]);

  const pathMembers = nodeIds
    .map((id) => ({ id, pathPos: pathIndex.get(id) }))
    .filter((n): n is { id: string; pathPos: number } => n.pathPos !== undefined);

  if (pathMembers.length > 1 && allSame) {
    // Multiple path nodes in same column — preserve path order.
    pathMembers.sort((a, b) => a.pathPos - b.pathPos);
    const pathOrdered = pathMembers.map((n) => n.id);
    const nonPath = nodeIds.filter((id) => !pathIndex.has(id));
    return [...pathOrdered, ...nonPath.sort((a, b) => a.localeCompare(b))];
  }

  // Default: alphabetical for determinism.
  return [...nodeIds].sort((a, b) => a.localeCompare(b));
}

// ─── Main pass ────────────────────────────────────────────────────────────────

/**
 * P2 — orders nodes within each column to minimise edge crossings.
 *
 * Does NOT set x or y — that is P3's job.
 * The cross-cutting column is skipped: its order is owned by P6.
 */
export const orderRows: LayoutPass = (input) => {
  const state = cloneState(input);

  // Skip cross-cutting — that column is owned by the cross-cutting pass.
  const mainColumns = state.columns.filter((col) => col.tier !== "cross-cutting");
  if (mainColumns.length < 2) return state;

  const clusters = buildClusters(state);
  const pathIndex = new Map<string, number>();
  state.primaryPath.forEach((id, index) => pathIndex.set(id, index));
  const columnOf = buildColumnOf(state);

  // Track best ordering seen.
  const currentOrder = new Map<string, string[]>();
  for (const col of mainColumns) {
    currentOrder.set(col.tier, [...col.nodeIds]);
  }
  let bestOrder = new Map(currentOrder);
  let bestCrossings = countCrossings(state);

  // Apply the initial ordering to state for counting.
  applyColumnOrders(state, mainColumns, bestOrder);

  // Sweep loop.
  for (let sweep = 0; sweep < MAX_ORDERING_SWEEPS; sweep += 1) {
    const direction = sweep % 2 === 0 ? "forward" : "backward";

    for (const column of mainColumns) {
      const colIndex = state.columns.indexOf(column);
      const newIds = orderClustersByMedian(state, colIndex, clusters, direction);
      currentOrder.set(column.tier, newIds);
    }

    applyColumnOrders(state, mainColumns, currentOrder);
    const crossings = countCrossings(state);

    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      bestOrder = new Map(currentOrder);
    }
  }

  // Apply the best ordering and apply within-cluster ordering.
  for (const column of mainColumns) {
    const ordered = bestOrder.get(column.tier)!;
    const orderedWithCluster = orderInsideCluster(ordered, pathIndex, state, columnOf);
    const colIdx = state.columns.indexOf(column);
    state.columns[colIdx]!.nodeIds = orderedWithCluster;
  }

  return state;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyColumnOrders(
  state: LayoutState,
  columns: LayoutColumn[],
  orders: Map<string, string[]>,
): void {
  for (const column of columns) {
    const ordered = orders.get(column.tier);
    if (ordered) {
      state.columns.find((c) => c.tier === column.tier)!.nodeIds = ordered;
    }
  }
}
