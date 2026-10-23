import { useMemo } from "react";
import type { Component, Connection } from "@/features/diagram";
import {
  buildPanelIds,
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
} from "./connectionDerivations";
import { resolveNodeDescriptor } from "../nodes/node-types/registry";
import { useActiveDirection } from "../hooks/useActiveDirection";

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
  const panelIds = useMemo(
    () => buildPanelIds(visibleComponents, resolveNodeDescriptor),
    [visibleComponents],
  );

  // Node positions are deliberately not an input here: handle sides are fixed,
  // so moving a node must never change which handles its edges use. See the
  // module comment in `connectionDerivations.ts`.
  const connectionCountPerNode = useMemo(
    () => buildConnectionCountPerNode(visibleConnections),
    [visibleConnections],
  );

  // The reading direction decides which real side a stored cross-axis edge
  // means (ADR-0013); it is the diagram's declaration, never node geometry.
  const direction = useActiveDirection();
  const edgeHandleAssignments = useMemo(
    () =>
      buildEdgeHandleAssignments(
        visibleConnections,
        connectionCountPerNode,
        resolvedComponents,
        direction,
      ),
    [visibleConnections, connectionCountPerNode, resolvedComponents, direction],
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
