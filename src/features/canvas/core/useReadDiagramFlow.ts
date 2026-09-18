import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import type { ViewSnapshot } from "./resolveViewSnapshot";
import {
  projectReadDiagramView,
  type ReadDiagramReading,
  type ReadDiagramRoutePlay,
} from "./projectReadDiagram";

export type { ReadDiagramReading, ReadDiagramRoutePlay };

/**
 * React wrapper around `projectReadDiagram` for Reader hosts. Also hands back
 * the view the nodes were drawn from, index for index.
 *
 * @example
 * const { nodes, edges } = useReadDiagramFlow(diagram, reading, routePlay);
 */
export function useReadDiagramFlow(
  diagram: Diagram,
  reading: ReadDiagramReading | null = null,
  routePlay: ReadDiagramRoutePlay | null = null,
  focusedNodeId: string | null = null,
): { nodes: Node[]; edges: Edge[]; view: ViewSnapshot } {
  return useMemo(
    () => projectReadDiagramView(diagram, reading, routePlay, focusedNodeId),
    [diagram, reading, routePlay, focusedNodeId],
  );
}
