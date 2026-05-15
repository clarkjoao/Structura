import type { Edge } from "@xyflow/react";
import type { EdgeLayout } from "@/features/diagram";

export function collectConnectionIdsToResetWaypoints(params: {
  edgeLayouts: Record<string, EdgeLayout> | undefined;
  selectedEdgeId: string | null;
  reactFlowEdges: Edge[];
}): string[] {
  const selectedFromFlow = params.reactFlowEdges.filter((edge) => edge.selected).map((edge) => edge.id);
  if (selectedFromFlow.length > 0) return selectedFromFlow;
  if (params.selectedEdgeId) return [params.selectedEdgeId];

  if (!params.edgeLayouts) return [];
  return Object.entries(params.edgeLayouts)
    .filter(([, layout]) => layout.waypoints.length > 0)
    .map(([connectionId]) => connectionId);
}

export function resetWaypointsForConnections(
  diagramId: string,
  connectionIds: string[],
  clearEdgeWaypoints: (diagramId: string, connectionId: string) => void,
): void {
  for (const connectionId of connectionIds) {
    clearEdgeWaypoints(diagramId, connectionId);
  }
}
