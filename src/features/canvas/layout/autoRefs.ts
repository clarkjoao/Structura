import type { LayoutGraph, LayoutNode, LayoutResult } from "./contract";
import { Position } from "@xyflow/react";
import { defaultOrthogonalCorners } from "../edges/geometry/orthogonal";
import { absoluteBoxesFromLayout } from "./absoluteBoxesFromLayout";
import { handleAlignedRoutes } from "./edgeLayoutsFromLayoutResult";
import { measurePolylines } from "./layoutReadability";
import { stepPolyline } from "./renderedEdgePath";

/**
 * Automatic references: the auto-layout's answer to a hub.
 *
 * A node that many things use, from other panels, is the case ELK draws worst:
 * every consumer competes for the same side of it, and each edge crossing into
 * or out of a panel is stitched in after the panels are arranged. A reference
 * to the hub inside the consumer's panel turns those edges into short ones
 * within a single panel, which is the case ELK draws best.
 *
 * Pure over the layout contract: the caller says which nodes may be referenced
 * and which parent a reference goes in; nothing here knows the store.
 */

/** A hub is used by at least this many things... */
export const AUTO_REF_MIN_FAN_IN = 4;
/** ...or by things in at least this many different containers. */
export const AUTO_REF_MIN_CONSUMER_PARENTS = 2;
/** Hubs tried per run, busiest first: each trial is one more ELK run. */
export const AUTO_REF_MAX_TRIALS = 6;
/** A route this much shorter in total wins a tie on crossings and overlaps. */
const LENGTH_TIE_BREAK = 0.9;

/** One reference to `originalId`, in `parentId`, that the edges from `sourceIds` end on. */
export interface AutoRefGroup {
  refId: string;
  originalId: string;
  parentId: string | null;
  /** Layout ids of the consumers whose edges go to the reference. */
  sourceIds: string[];
  /** The layout edges moved onto the reference. */
  edgeIds: string[];
}

export interface AutoRefPlanOptions {
  /** Whether a reference may stand for this layout node. */
  canReference: (nodeId: string) => boolean;
  /**
   * The container a reference to a consumer in `parentId` goes in: `parentId`
   * itself, or the nearest ancestor that takes a reference.
   */
  refParentFor: (parentId: string | null) => string | null;
  /** The id for the reference to `originalId` in `parentId`: an existing one to reuse, or a new one. */
  refIdFor: (originalId: string, parentId: string | null) => string;
  refSize: { width: number; height: number };
}

/**
 * The references each hub would get, grouped by hub. One reference per hub
 * and consumer container, never one per edge; the original always keeps at
 * least one edge, so it never ends up used by nothing but its own copies.
 */
export function planAutoRefs(graph: LayoutGraph, options: AutoRefPlanOptions): AutoRefGroup[][] {
  const parentOf = new Map(graph.nodes.map((node) => [node.id, node.parentId] as const));
  const incoming = new Map<string, LayoutGraph["edges"]>();
  for (const edge of graph.edges) {
    const list = incoming.get(edge.targetId) ?? [];
    list.push(edge);
    incoming.set(edge.targetId, list);
  }

  const hubs: Array<{ fanIn: number; groups: AutoRefGroup[] }> = [];
  for (const [targetId, edges] of incoming) {
    if (!options.canReference(targetId)) continue;
    const consumerParents = new Set(edges.map((edge) => parentOf.get(edge.sourceId) ?? null));
    const isHub =
      edges.length >= AUTO_REF_MIN_FAN_IN || consumerParents.size >= AUTO_REF_MIN_CONSUMER_PARENTS;
    if (!isHub) continue;

    const home = options.refParentFor(parentOf.get(targetId) ?? null);
    const byParent = new Map<string | null, LayoutGraph["edges"]>();
    let keepsAnEdge = false;
    for (const edge of edges) {
      const refParent = options.refParentFor(parentOf.get(edge.sourceId) ?? null);
      // A reference beside the original gains nothing: the edge is already short.
      if (refParent === home) {
        keepsAnEdge = true;
        continue;
      }
      const list = byParent.get(refParent) ?? [];
      list.push(edge);
      byParent.set(refParent, list);
    }

    const groups = [...byParent.entries()].map(([parentId, grouped]) => ({
      refId: options.refIdFor(targetId, parentId),
      originalId: targetId,
      parentId,
      sourceIds: [...new Set(grouped.map((edge) => edge.sourceId))],
      edgeIds: grouped.map((edge) => edge.id),
    }));
    if (!keepsAnEdge && groups.length > 0) {
      // The busiest container stays on the original.
      let busiest = 0;
      groups.forEach((group, index) => {
        if (group.edgeIds.length > groups[busiest].edgeIds.length) busiest = index;
      });
      groups.splice(busiest, 1);
    }
    if (groups.length > 0) hubs.push({ fanIn: edges.length, groups });
  }

  hubs.sort((a, b) => b.fanIn - a.fanIn);
  return hubs.map((hub) => hub.groups);
}

/** The graph with each group's reference added and its edges ending there. */
export function splitGraph(
  graph: LayoutGraph,
  groups: readonly AutoRefGroup[],
  refSize: { width: number; height: number },
): LayoutGraph {
  if (groups.length === 0) return graph;
  const retarget = new Map<string, string>();
  const refs: LayoutNode[] = [];
  for (const group of groups) {
    refs.push({ id: group.refId, parentId: group.parentId, ...refSize });
    for (const edgeId of group.edgeIds) retarget.set(edgeId, group.refId);
  }
  return {
    nodes: [...graph.nodes, ...refs],
    edges: graph.edges.map((edge) => {
      const refId = retarget.get(edge.id);
      return refId === undefined ? edge : { ...edge, targetId: refId };
    }),
  };
}

export interface LayoutScore {
  edgeCrossings: number;
  edgeNodeOverlaps: number;
  /** Total length of the routed edges. */
  length: number;
}

/**
 * Crossings and edges through nodes over the path the canvas draws after an
 * auto-layout: ELK's corridor moved onto the handles. ELK's own routes never
 * cross a node, and the drawn ones do, so that is what a trial is judged on.
 */
export function scoreLayout(graph: LayoutGraph, result: LayoutResult): LayoutScore {
  const boxes = absoluteBoxesFromLayout(graph, result);
  const present = new Set(graph.nodes.map((node) => node.id));
  const parentOf = new Map(
    graph.nodes.map((node) => [
      node.id,
      node.parentId !== null && present.has(node.parentId) ? node.parentId : null,
    ]),
  );
  const routes = handleAlignedRoutes(graph, result);
  const edges = graph.edges.flatMap((edge) => {
    const route = routes.get(edge.id);
    if (!route) return [];
    const corners =
      route.corners.length > 0
        ? route.corners
        : defaultOrthogonalCorners(route.source, route.target, Position.Right);
    return [
      {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        points: stepPolyline(route.source, route.target, corners),
      },
    ];
  });
  const report = measurePolylines({
    boxes,
    parentOf,
    edges,
    rootId: "root",
    width: result.bounds.width,
    height: result.bounds.height,
  });
  let length = 0;
  for (const edge of edges) {
    for (let i = 1; i < edge.points.length; i += 1) {
      length += Math.hypot(
        edge.points[i].x - edge.points[i - 1].x,
        edge.points[i].y - edge.points[i - 1].y,
      );
    }
  }
  return {
    edgeCrossings: report.edgeCrossings,
    edgeNodeOverlaps: report.edgeNodeOverlaps,
    length,
  };
}

/** An edge through a node reads worse than two edges crossing. */
function weight(score: LayoutScore): number {
  return score.edgeCrossings + 2 * score.edgeNodeOverlaps;
}

/** Whether `trial` reads better than `best`: fewer crossings and overlaps, or as few and much shorter. */
export function isBetterLayout(trial: LayoutScore, best: LayoutScore): boolean {
  const trialWeight = weight(trial);
  const bestWeight = weight(best);
  if (trialWeight !== bestWeight) return trialWeight < bestWeight;
  return trial.length < best.length * LENGTH_TIE_BREAK;
}

export interface AutoRefChoice {
  graph: LayoutGraph;
  result: LayoutResult;
  groups: AutoRefGroup[];
  baseline: LayoutScore;
  score: LayoutScore;
}

/**
 * Lays `graph` out and keeps each hub's references only where they read
 * better, one hub at a time, busiest first. The returned graph and result are
 * the ones the kept references were measured in: ELK depends on node order,
 * so the layout that is applied must be the very one that was judged.
 */
export async function chooseAutoRefs(
  graph: LayoutGraph,
  options: AutoRefPlanOptions,
  run: (graph: LayoutGraph) => Promise<LayoutResult>,
): Promise<AutoRefChoice> {
  const result = await run(graph);
  const baseline = scoreLayout(graph, result);
  let best: AutoRefChoice = { graph, result, groups: [], baseline, score: baseline };

  const hubs = planAutoRefs(graph, options).slice(0, AUTO_REF_MAX_TRIALS);
  for (const hubGroups of hubs) {
    const groups = [...best.groups, ...hubGroups];
    const trialGraph = splitGraph(graph, groups, options.refSize);
    const trialResult = await run(trialGraph);
    const score = scoreLayout(trialGraph, trialResult);
    if (isBetterLayout(score, best.score)) {
      best = { graph: trialGraph, result: trialResult, groups, baseline, score };
    }
  }
  return best;
}
