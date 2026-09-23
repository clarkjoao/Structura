import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import { EMPTY_READER_CATALOG, type ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
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
  catalog: ReaderCatalog = EMPTY_READER_CATALOG,
): { nodes: Node[]; edges: Edge[]; view: ViewSnapshot } {
  return useMemo(
    () => projectReadDiagramView(diagram, reading, routePlay, focusedNodeId, catalog),
    [diagram, reading, routePlay, focusedNodeId, catalog],
  );
}
