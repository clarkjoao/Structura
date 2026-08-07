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

  resolvedComponents: Record<string, Component>;
}

export function useCanvasConnectionDerivations({
  visibleComponents,
  visibleConnections,
  resolvedComponents,
}: UseCanvasConnectionDerivationsParams) {
  const panelIds = useMemo(() => buildPanelIds(visibleComponents), [visibleComponents]);

  // Node positions are deliberately not an input here: handle sides are fixed,
  // so moving a node must never change which handles its edges use. See the
  // module comment in `connectionDerivations.ts`.
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
