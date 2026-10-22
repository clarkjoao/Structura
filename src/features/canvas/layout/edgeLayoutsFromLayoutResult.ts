import type { EdgeLayout } from "@/features/diagram";
import { generateId } from "@/features/diagram";
import { MAX_HANDLES, MIN_HANDLES } from "../canvas.constants";
import type { LayoutGraph, LayoutResult } from "./contract";
import { absoluteBoxesFromLayout } from "./absoluteBoxesFromLayout";
import { alignElkRouteToHandles } from "./alignElkRouteToHandles";
import { handleAnchor } from "./renderedEdgePath";
import { straightenPolylines } from "./straightenRoutes";
import { getClosestOffsetOnPath } from "../edges/geometry/projection";
import { Position } from "@xyflow/react";
import { defaultOrthogonalCorners, pruneRedundantCorners } from "../edges/geometry/orthogonal";

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
 * Used by store-backed `applyLayoutResultEdges`.
 *
 * @example
 * const edgeLayouts = edgeLayoutsFromLayoutResult(graph, result);
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

  const routes = handleAlignedRoutes(graph, result, edgesToStyle, positionOverrides);
  const layouts: Record<string, EdgeLayout> = {};
  for (const edge of edgesToStyle) {
    const storeEdgeId = edgeIdOf(edge.id);
    if (storeEdgeId === undefined) continue;
    const route = routes.get(edge.id);
    // The label goes where ELK reserved its room, as the offset along the drawn
    // path closest to it: the path midpoint the canvas defaults to can be a
    // whole layer away, on top of another label.
    const labelCenter = result.labelCenters?.get(edge.id);
    layouts[storeEdgeId] = {
      points: (route?.corners ?? []).map((point) => ({
        id: generateId("cp"),
        x: point.x + waypointOffset.x,
        y: point.y + waypointOffset.y,
      })),
      ...(route && labelCenter
        ? {
            labelOffset: getClosestOffsetOnPath(
              route.source,
              route.target,
              route.corners,
              labelCenter,
            ),
          }
        : {}),
    };
  }
  return layouts;
}

/** Where an edge leaves, where it arrives, and the corners the canvas draws it through. */
export interface HandleAlignedRoute {
  source: { x: number; y: number };
  target: { x: number; y: number };
  corners: Array<{ x: number; y: number }>;
}

/**
 * ELK's corridor for each edge, moved onto the handle slots the canvas draws
 * it from: the path an auto-layout leaves on screen. An edge with an endpoint
 * the layout did not place has no route.
 */
export function handleAlignedRoutes(
  graph: LayoutGraph,
  result: LayoutResult,
  edges: LayoutGraph["edges"] = graph.edges,
  positionOverrides?: Map<string, { x: number; y: number }>,
): Map<string, HandleAlignedRoute> {
  const absBoxes = absoluteBoxesFromLayout(graph, result, positionOverrides);
  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();
  for (const edge of graph.edges) {
    outgoingCount.set(edge.sourceId, (outgoingCount.get(edge.sourceId) ?? 0) + 1);
    incomingCount.set(edge.targetId, (incomingCount.get(edge.targetId) ?? 0) + 1);
  }

  const routes = new Map<string, HandleAlignedRoute>();
  for (const edge of edges) {
    const sourceBox = absBoxes.get(edge.sourceId);
    const targetBox = absBoxes.get(edge.targetId);
    if (!sourceBox || !targetBox) continue;

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
    const corners = alignElkRouteToHandles(result.edgeRoutes.get(edge.id), source, target);
    routes.set(edge.id, { source, target, corners });
  }
  return straightenJogs(routes);
}

/**
 * Snapping ELK's attachments onto handle slots leaves a short step near the
 * ends of many routes; `straightenPolylines` removes the ones it can without
 * adding a crossing.
 */
function straightenJogs(routes: Map<string, HandleAlignedRoute>): Map<string, HandleAlignedRoute> {
  const polylines = new Map(
    [...routes].map(([id, route]) => [id, [route.source, ...route.corners, route.target]] as const),
  );
  for (const [id, points] of straightenPolylines(polylines)) {
    const route = routes.get(id)!;
    if (points === polylines.get(id)) continue;
    const corners = pruneRedundantCorners(route.source, route.target, points.slice(1, -1));
    routes.set(id, {
      ...route,
      corners:
        corners.length > 0
          ? corners
          : defaultOrthogonalCorners(route.source, route.target, Position.Right),
    });
  }
  return routes;
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
