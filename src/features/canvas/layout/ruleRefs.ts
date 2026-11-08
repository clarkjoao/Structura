import type { LayoutGraph, LayoutResult } from "./contract";
import type { AutoRefGroup, AutoRefPlanOptions } from "./autoRefs";
import { absoluteBoxesFromLayout } from "./absoluteBoxesFromLayout";

/**
 * References by reading rules: the auto-layout's answer to a connection that
 * points back.
 *
 * A diagram reads along its axis, left to right here (a top-to-bottom diagram
 * runs this on the mirrored graph, `axis.ts`). A connection whose target sits
 * further back than its source has to travel against the reading to get
 * there. Close by, that is a short back-edge and reads as one (ADR-0013). Far
 * back, it is the longest line on the canvas, crossing everything on the way:
 * it ends instead on a reference to the target, beside its consumer.
 *
 * The rules, measured on a layout without references:
 *
 *   1. a back-connection to a target at most `neighborColumns` columns back
 *      stays as it is;
 *   2. further back, it ends on a reference — one per target and consumer
 *      container, never one per connection;
 *   3. with `forward`, so does a forward connection longer than
 *      `forwardColumns` columns;
 *   4. the original keeps at least `minKeep` connections: when the rules would
 *      take more, the closest consumers stay on it.
 *
 * Decided per consumer, not per connection, because that is the unit the
 * store moves (`reconcileAutoRefs`): every connection from a consumer to the
 * original goes to the reference together.
 *
 * Pure over the layout contract, like `autoRefs.ts`.
 */

export interface RuleRefOptions {
  neighborColumns: number;
  minKeep: number;
  /** A forward connection longer than this many columns ends on a reference; absent, none does. */
  forwardColumns?: number;
}

/** What the rules found, for the summary the editor shows. */
export interface RuleRefStats {
  /** Connections that point back against the reading. */
  backEdges: number;
  /** Back-connections left as short back-edges, their target close enough. */
  neighborBackEdges: number;
  /** Connections moved onto a reference. */
  movedEdges: number;
  /** Connections the rules would have moved, left on the original for `minKeep`. */
  keptOnOriginal: number;
  /** References made. */
  refs: number;
}

export interface RuleRefPlan {
  groups: AutoRefGroup[];
  stats: RuleRefStats;
}

interface Measured {
  edge: LayoutGraph["edges"][number];
  back: boolean;
  columns: number;
}

/**
 * The column each element sits in: elements are taken along the reading, and
 * one starts a new column once it is more than half a typical element past
 * where the current column began. A count of the columns elements occupy, not
 * a distance: the gaps between layers, and the layers ELK adds for edge
 * labels, do not make two elements further apart. Containers are left out:
 * they span what they hold.
 */
export function columnsOf(graph: LayoutGraph, result: LayoutResult): Map<string, number> {
  const boxes = absoluteBoxesFromLayout(graph, result);
  const parents = new Set(graph.nodes.map((node) => node.parentId));
  const leaves = graph.nodes.flatMap((node) => {
    const box = boxes.get(node.id);
    return box && !parents.has(node.id)
      ? [{ id: node.id, centre: box.x + box.width / 2, width: box.width }]
      : [];
  });
  const widths = leaves.map((leaf) => leaf.width).sort((a, b) => a - b);
  const slack = (widths.length > 0 ? widths[Math.floor(widths.length / 2)] : 0) / 2;
  leaves.sort((a, b) => a.centre - b.centre);
  const columns = new Map<string, number>();
  let column = -1;
  let start = -Infinity;
  for (const leaf of leaves) {
    if (leaf.centre - start > slack) {
      column += 1;
      start = leaf.centre;
    }
    columns.set(leaf.id, column);
  }
  return columns;
}

/** Each connection's direction along the reading and how many columns it spans. */
function measure(graph: LayoutGraph, result: LayoutResult): Measured[] {
  const columns = columnsOf(graph, result);
  return graph.edges.flatMap((edge) => {
    if (edge.sourceId === edge.targetId) return [];
    const from = columns.get(edge.sourceId);
    const to = columns.get(edge.targetId);
    if (from === undefined || to === undefined) return [];
    return [{ edge, back: to < from, columns: Math.abs(to - from) }];
  });
}

export function planRuleRefs(
  graph: LayoutGraph,
  result: LayoutResult,
  options: AutoRefPlanOptions,
  rules: RuleRefOptions,
): RuleRefPlan {
  const measured = measure(graph, result);
  const backEdges = measured.filter((m) => m.back);
  const neighborBackEdges = backEdges.filter((m) => m.columns <= rules.neighborColumns).length;

  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    for (const id of [edge.sourceId, edge.targetId]) degree.set(id, (degree.get(id) ?? 0) + 1);
  }

  // Every connection to a target, by consumer, and whether a rule asks to move it.
  const byTarget = new Map<string, Map<string, { edges: Measured[]; columns: number }>>();
  const wanted = new Set<string>();
  for (const m of measured) {
    const far = m.back
      ? m.columns > rules.neighborColumns
      : rules.forwardColumns !== undefined && m.columns > rules.forwardColumns;
    if (far && options.canReference(m.edge.targetId)) wanted.add(m.edge.id);
    const consumers = byTarget.get(m.edge.targetId) ?? new Map();
    const entry = consumers.get(m.edge.sourceId) ?? { edges: [], columns: Infinity };
    entry.edges.push(m);
    entry.columns = Math.min(entry.columns, m.columns);
    consumers.set(m.edge.sourceId, entry);
    byTarget.set(m.edge.targetId, consumers);
  }

  const parentOf = new Map(graph.nodes.map((node) => [node.id, node.parentId] as const));
  const groups = new Map<string, AutoRefGroup>();
  let movedEdges = 0;
  let keptOnOriginal = 0;
  for (const [targetId, consumers] of byTarget) {
    // A consumer moves only when every connection it has to the target is one a rule moves.
    const moving = [...consumers.entries()]
      .filter(([, entry]) => entry.edges.every((m) => wanted.has(m.edge.id)))
      .sort((a, b) => a[1].columns - b[1].columns);
    if (moving.length === 0) continue;
    const movingEdges = moving.reduce((sum, [, entry]) => sum + entry.edges.length, 0);
    let left = (degree.get(targetId) ?? 0) - movingEdges;
    // Closest first: they are the ones that read best left on the original.
    while (left < rules.minKeep && moving.length > 0) {
      const [, entry] = moving.shift()!;
      left += entry.edges.length;
      keptOnOriginal += entry.edges.length;
    }
    for (const [sourceId, entry] of moving) {
      const parentId = options.refParentFor(parentOf.get(sourceId) ?? null);
      const key = `${targetId}\u0000${parentId ?? ""}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          refId: options.refIdFor(targetId, parentId),
          originalId: targetId,
          parentId,
          sourceIds: [],
          edgeIds: [],
        };
        groups.set(key, group);
      }
      group.sourceIds.push(sourceId);
      for (const m of entry.edges) group.edgeIds.push(m.edge.id);
      movedEdges += entry.edges.length;
    }
  }

  return {
    groups: [...groups.values()],
    stats: {
      backEdges: backEdges.length,
      neighborBackEdges,
      movedEdges,
      keptOnOriginal,
      refs: groups.size,
    },
  };
}
