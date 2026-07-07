import { useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import {
  collectConnectionIdsToResetWaypoints,
  resetWaypointsForConnections,
} from "../../edges/reset-edge-waypoints";
import { isModKeyPressed, keyMatchesLetter, KEY, type KeyHandler } from "./helpers";

interface UseEdgeWaypointShortcutsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  selectedEdgeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  resetEdgeControlPoints: (diagramId: string, connectionId: string) => void;
}

export function useEdgeWaypointShortcuts({
  diagram,
  selectedEdgeId,
  reactFlowInstance,
  resetEdgeControlPoints,
}: UseEdgeWaypointShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!diagram?.id) return false;
      const mod = isModKeyPressed(e);
      if (!mod || !e.shiftKey || !keyMatchesLetter(e, KEY.W)) return false;

      e.preventDefault();
      const connectionIds = collectConnectionIdsToResetWaypoints({
        edgeLayouts: diagram.edgeLayouts,
        selectedEdgeId,
        reactFlowEdges: reactFlowInstance.getEdges(),
      });
      resetWaypointsForConnections(diagram.id, connectionIds, resetEdgeControlPoints);
      return true;
    },
    [diagram, selectedEdgeId, reactFlowInstance, resetEdgeControlPoints],
  );
}
