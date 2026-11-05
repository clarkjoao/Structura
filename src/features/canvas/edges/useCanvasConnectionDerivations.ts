import { useMemo, useRef } from "react";
import type { Component, Connection } from "@/features/diagram";
import {
  buildPanelIds,
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  stabilizeHandleOrder,
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

  // Rebuilt on every store write (its inputs are); each node keeps its entry's
  // identity while its slots are unchanged, so the node identity cache holds.
  const previousHandleOrder = useRef<ReturnType<typeof buildEffectiveHandleOrder>>({});
  const effectiveHandleOrder = useMemo(() => {
    const next = stabilizeHandleOrder(
      previousHandleOrder.current,
      buildEffectiveHandleOrder(edgeHandleAssignments, visibleConnections),
    );
    previousHandleOrder.current = next;
    return next;
  }, [edgeHandleAssignments, visibleConnections]);

  return {
    panelIds,
    connectionCountPerNode,
    edgeHandleAssignments,
    effectiveHandleOrder,
  };
}
