import { useMemo } from "react";
import type { Component, Connection, Diagram } from "@/features/diagram";
import {
  buildPanelIds,
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
} from "./connectionDerivations";

interface UseCanvasConnectionDerivationsParams {
  visibleComponents: Component[];
  visibleConnections: Connection[];
  diagram: Diagram | null | undefined;
}

export function useCanvasConnectionDerivations({
  visibleComponents,
  visibleConnections,
  diagram,
}: UseCanvasConnectionDerivationsParams) {
  const panelIds = useMemo(
    () => buildPanelIds(visibleComponents),
    [visibleComponents],
  );

  const connectionCountPerNode = useMemo(
    () => buildConnectionCountPerNode(visibleConnections),
    [visibleConnections],
  );

  const edgeHandleAssignments = useMemo(
    () => buildEdgeHandleAssignments(visibleConnections, connectionCountPerNode, diagram),
    [visibleConnections, connectionCountPerNode, diagram],
  );

  const effectiveHandleOrder = useMemo(
    () => buildEffectiveHandleOrder(edgeHandleAssignments, visibleConnections),
    [edgeHandleAssignments, visibleConnections],
  );

  return {
    panelIds,
    connectionCountPerNode,
    edgeHandleAssignments,
    effectiveHandleOrder,
  };
}
