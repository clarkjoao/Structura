import type { Edge } from "@xyflow/react";
import type { Connection, EdgeLayout } from "@/features/diagram";

export function collectConnectionIdsToResetWaypoints(params: {
  edgeLayouts: Record<string, EdgeLayout> | undefined;
  selectedEdgeId: string | null;
  reactFlowEdges: Edge[];
}): string[] {
  const selectedFromFlow = params.reactFlowEdges
    .filter((edge) => edge.selected)
    .map((edge) => edge.id);
  if (selectedFromFlow.length > 0) return selectedFromFlow;
  if (params.selectedEdgeId) return [params.selectedEdgeId];

  if (!params.edgeLayouts) return [];
  return Object.entries(params.edgeLayouts)
    .filter(([, layout]) => (layout.points?.length ?? 0) > 0)
    .map(([connectionId]) => connectionId);
}

export function resetWaypointsForConnections(
  diagramId: string,
  connectionIds: string[],
  resetEdgeControlPoints: (diagramId: string, connectionId: string) => void,
): void {
  for (const connectionId of connectionIds) {
    resetEdgeControlPoints(diagramId, connectionId);
  }
}

/**
 * Connections with exactly one end inside `nodeIds`.
 *
 * Laying out part of a diagram moves nodes that edges outside the selection
 * still point at. `fromDiagram` drops a connection unless **both** endpoints
 * are in scope, so a crossing edge never reaches ELK and never reaches
 * `applyLayoutResultEdges` either — its stored control points survive and go on
 * describing a path to where the node used to be.
 *
 * The edge stays attached: sides are fixed and the canvas redraws it from the
 * handles. It is only the stored path that goes stale, which is why clearing
 * exactly these is the whole fix.
 */
export function collectBoundaryConnectionIds(
  connections: readonly Connection[],
  nodeIds: ReadonlySet<string>,
): string[] {
  if (nodeIds.size === 0) return [];
  return connections
    .filter((connection) => {
      const from = nodeIds.has(connection.sourceId);
      const to = nodeIds.has(connection.targetId);
      return from !== to;
    })
    .map((connection) => connection.id);
}
