import { useMemo } from "react";
import type { Component, Connection } from "@/features/diagram";
import {
  buildPanelIds,
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
} from "./connectionDerivations";

interface UseCanvasConnectionDerivationsParams {
  visibleComponents: Component[];
  visibleConnections: Connection[];
  /** Snapshot components — stable when component data unchanged (unlike full diagram ref on every mutation). */
  resolvedComponents: Record<string, Component>;
}

export function useCanvasConnectionDerivations({
  visibleComponents,
  visibleConnections,
  resolvedComponents,
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
    () =>
      buildEdgeHandleAssignments(visibleConnections, connectionCountPerNode, resolvedComponents),
    [visibleConnections, connectionCountPerNode, resolvedComponents],
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
