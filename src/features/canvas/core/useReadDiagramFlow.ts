import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import {
  projectReadDiagram,
  type ReadDiagramReading,
  type ReadDiagramRoutePlay,
} from "./projectReadDiagram";

export type { ReadDiagramReading, ReadDiagramRoutePlay };

/**
 * React wrapper around {@link projectReadDiagram} for Reader hosts.
 *
 * @example
 * const { nodes, edges } = useReadDiagramFlow(diagram, reading, routePlay);
 */
export function useReadDiagramFlow(
  diagram: Diagram,
  reading: ReadDiagramReading | null = null,
  routePlay: ReadDiagramRoutePlay | null = null,
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(
    () => projectReadDiagram(diagram, reading, routePlay),
    [diagram, reading, routePlay],
  );
}
