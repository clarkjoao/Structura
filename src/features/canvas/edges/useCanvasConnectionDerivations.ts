import { useMemo } from "react";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { DEFAULT_NODE_W, DEFAULT_NODE_H } from "@/features/diagram";
import { resolveAbsolutePosition } from "../models/panelParenting";
import {
  buildPanelIds,
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  type NodeBox,
} from "./connectionDerivations";

interface UseCanvasConnectionDerivationsParams {
  visibleComponents: Component[];
  visibleConnections: Connection[];

  resolvedComponents: Record<string, Component>;
  resolvedNodeLayouts?: Record<string, NodeLayout>;
}

/**
 * Absolute boxes for the nodes an edge can attach to.
 *
 * Layouts are stored relative to the parent, so a node inside a panel and one
 * outside it are not directly comparable — which is exactly what deciding a side
 * requires. `resolveAbsolutePosition` already walks the parent chain; this only
 * adds the size.
 */
function buildNodeBoxes(
  components: Record<string, Component>,
  nodeLayouts: Record<string, NodeLayout>,
): Record<string, NodeBox> {
  const boxes: Record<string, NodeBox> = {};
  for (const [id, layout] of Object.entries(nodeLayouts)) {
    if (!components[id]) continue;
    const absolute = resolveAbsolutePosition(
      id,
      { x: layout.x, y: layout.y },
      components,
      nodeLayouts,
    );
    boxes[id] = {
      x: absolute.x,
      y: absolute.y,
      width: layout.width ?? DEFAULT_NODE_W,
      height: layout.height ?? DEFAULT_NODE_H,
    };
  }
  return boxes;
}

export function useCanvasConnectionDerivations({
  visibleComponents,
  visibleConnections,
  resolvedComponents,
  resolvedNodeLayouts,
}: UseCanvasConnectionDerivationsParams) {
  const panelIds = useMemo(() => buildPanelIds(visibleComponents), [visibleComponents]);

  const nodeBoxes = useMemo(
    () =>
      resolvedNodeLayouts ? buildNodeBoxes(resolvedComponents, resolvedNodeLayouts) : undefined,
    [resolvedComponents, resolvedNodeLayouts],
  );

  const connectionCountPerNode = useMemo(
    () => buildConnectionCountPerNode(visibleConnections, nodeBoxes),
    [visibleConnections, nodeBoxes],
  );

  const edgeHandleAssignments = useMemo(
    () =>
      buildEdgeHandleAssignments(
        visibleConnections,
        connectionCountPerNode,
        resolvedComponents,
        nodeBoxes,
      ),
    [visibleConnections, connectionCountPerNode, resolvedComponents, nodeBoxes],
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
