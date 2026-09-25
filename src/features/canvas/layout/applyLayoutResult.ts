import type { LayoutGraph, LayoutResult } from "./contract";
import { useDiagramStore } from "@/features/diagram";
import {
  edgeLayoutsFromLayoutResult,
  type EdgeLayoutsFromResultOptions,
} from "./edgeLayoutsFromLayoutResult";

/**
 * Parameters for the unified layout applicator.
 *
 * `diagramId` is null when there is no active diagram — the function still
 * applies positions via `applyAutoLayout`, but skips edge effects.
 */
export type ApplyLayoutResultOptions = EdgeLayoutsFromResultOptions;

/** Identity, so the common case pays nothing for the generation path's mapping. */
const identity = (id: string): string | undefined => id;

/**
 * The three post-layout steps, in one place, so they cannot drift apart.
 *
 * Every consumer of `layout()` repeats this sequence after getting the result:
 *
 *   1. write positions via `applyAutoLayout`  ← the caller owns the `toAppliedLayouts` call
 *   2. write ELK's handle ordering into every node's `handleOrder`
 *   3. write handle-aligned ELK corridors as edge control points
 *
 * Separating positions from (2) and (3) allows the caller to pass their own
 * offset (`toAppliedLayouts(graph, result, resizable, offset)`) without
 * duplicating the edge-writing logic.
 *
 * This function does NOT call `applyAutoLayout` — the caller already does that.
 * It only handles the edge effects.
 */
export function applyLayoutResultEdges(
  graph: LayoutGraph,
  result: LayoutResult,
  diagramId: string | null,
  options: ApplyLayoutResultOptions = {},
): void {
  const { edgeIds = null, resetPaths = false } = options;
  const nodeIdOf = options.idMap?.node ?? identity;
  const edgeIdOf = options.idMap?.edge ?? identity;

  if (diagramId === null) return;

  const store = useDiagramStore.getState();

  const edgesToStyle =
    edgeIds === null ? graph.edges : graph.edges.filter((edge) => edgeIds.has(edge.id));

  for (const node of graph.nodes) {
    const storeNodeId = nodeIdOf(node.id);
    if (storeNodeId === undefined) continue;
    for (const side of ["outgoing", "incoming"] as const) {
      const ordering = result.handleOrder[side].get(node.id);
      if (!ordering?.length) continue;
      const storeOrdering = ordering.map(edgeIdOf).filter((id): id is string => id !== undefined);
      if (storeOrdering.length === 0) continue;
      store.updateHandleOrder(storeNodeId, side, storeOrdering);
    }
  }

  for (const edge of edgesToStyle) {
    const storeEdgeId = edgeIdOf(edge.id);
    if (storeEdgeId !== undefined) store.resetEdgeControlPoints(diagramId, storeEdgeId);
  }

  if (resetPaths) return;

  const layouts = edgeLayoutsFromLayoutResult(graph, result, { ...options, resetPaths: false });
  const connections = store.diagrams?.[diagramId]?.snapshot.connections ?? {};

  for (const edge of edgesToStyle) {
    const storeEdgeId = edgeIdOf(edge.id);
    if (storeEdgeId === undefined) continue;
    // ELK routes every edge out of the right and into the left. An edge the user
    // put on a top or bottom handle would be forced through that corridor, so it
    // keeps the default route, which starts from the handle it actually uses.
    const conn = connections[storeEdgeId];
    if (conn?.sourceSide || conn?.targetSide) continue;
    const points = layouts[storeEdgeId]?.points ?? [];
    if (points.length === 0) continue;
    store.setEdgeControlPoints(diagramId, storeEdgeId, points, { history: false });
  }
}
