import type { EdgeLayout } from "@/features/diagram";
import { generateId } from "@/features/diagram";
import { MAX_HANDLES, MIN_HANDLES } from "../canvas.constants";
import type { LayoutGraph, LayoutResult } from "./contract";
import { absoluteBoxesFromLayout } from "./absoluteBoxesFromLayout";
import { alignElkRouteToHandles } from "./alignElkRouteToHandles";
import { handleAnchor } from "./renderedEdgePath";

export interface EdgeLayoutsFromResultOptions {
  /** Which edges get waypoints. Defaults to all graph edges. */
  edgeIds?: ReadonlySet<string> | null;
  positionOverrides?: Map<string, { x: number; y: number }>;
  waypointOffset?: { x: number; y: number };
  /** Empty `points` for each edge — mid-X Z at draw time. */
  resetPaths?: boolean;
  idMap?: {
    node?: (graphNodeId: string) => string | undefined;
    edge?: (graphEdgeId: string) => string | undefined;
  };
}

const identity = (id: string): string | undefined => id;

/**
 * Pure handle-aligned ELK corridors as `EdgeLayout` records.
 *
 * Used by `applyLayoutResultEdges` to write edge waypoints back into the store,
 * and by the editor's auto-layout (Cmd/Ctrl+Shift+L).
 */
export function edgeLayoutsFromLayoutResult(
  graph: LayoutGraph,
  result: LayoutResult,
  options: EdgeLayoutsFromResultOptions = {},
): Record<string, EdgeLayout> {
  const {
    edgeIds = null,
    waypointOffset = { x: 0, y: 0 },
    resetPaths = false,
    positionOverrides,
  } = options;
  const edgeIdOf = options.idMap?.edge ?? identity;

  const edgesToStyle =
    edgeIds === null ? graph.edges : graph.edges.filter((edge) => edgeIds.has(edge.id));

  if (resetPaths) {
    const cleared: Record<string, EdgeLayout> = {};
    for (const edge of edgesToStyle) {
      const storeEdgeId = edgeIdOf(edge.id);
      if (storeEdgeId !== undefined) cleared[storeEdgeId] = { points: [] };
    }
    return cleared;
  }

  const absBoxes = absoluteBoxesFromLayout(graph, result, positionOverrides);
  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();
  for (const edge of graph.edges) {
    outgoingCount.set(edge.sourceId, (outgoingCount.get(edge.sourceId) ?? 0) + 1);
    incomingCount.set(edge.targetId, (incomingCount.get(edge.targetId) ?? 0) + 1);
  }

  const layouts: Record<string, EdgeLayout> = {};
  for (const edge of edgesToStyle) {
    const storeEdgeId = edgeIdOf(edge.id);
    if (storeEdgeId === undefined) continue;

    const sourceBox = absBoxes.get(edge.sourceId);
    const targetBox = absBoxes.get(edge.targetId);
    if (!sourceBox || !targetBox) {
      layouts[storeEdgeId] = { points: [] };
      continue;
    }

    const sourceCount = clampHandleCount(outgoingCount.get(edge.sourceId) ?? 1);
    const targetCount = clampHandleCount(incomingCount.get(edge.targetId) ?? 1);
    const sourceSlot = resolveSlot(
      edge.id,
      result.handleOrder.outgoing.get(edge.sourceId),
      sourceCount,
    );
    const targetSlot = resolveSlot(
      edge.id,
      result.handleOrder.incoming.get(edge.targetId),
      targetCount,
    );

    const source = handleAnchor(sourceBox, "source", sourceSlot, sourceCount);
    const target = handleAnchor(targetBox, "target", targetSlot, targetCount);
    const route = result.edgeRoutes.get(edge.id);
    const corners = alignElkRouteToHandles(route, source, target);

    layouts[storeEdgeId] = {
      points: corners.map((point) => ({
        id: generateId("cp"),
        x: point.x + waypointOffset.x,
        y: point.y + waypointOffset.y,
      })),
    };
  }
  return layouts;
}

function clampHandleCount(count: number): number {
  return Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, count));
}

function resolveSlot(edgeId: string, order: string[] | undefined, slotCount: number): number {
  if (order?.length) {
    const index = order.indexOf(edgeId);
    if (index !== -1) return Math.min(index, slotCount - 1);
  }
  return 0;
}
