import type { Edge, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import { EMPTY_READER_CATALOG, type ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
} from "../edges/connectionDerivations";
import { resolveNodeDescriptor } from "../nodes/node-types";
import { buildReadNodeContext, type ReadDiagramReading } from "./buildReadNodeContext";
import { readPolicy } from "./canvasInteractionPolicy";
import { projectDiagram } from "./projectDiagram";
import { resolveViewSnapshot, type ViewSnapshot } from "./resolveViewSnapshot";

export type { ReadDiagramReading };

/** How a reader starts a script from a route or group on the picture. */
export interface ReadDiagramRoutePlay {
  onPlayFlow: (flowId: string) => void;
}

/**
 * Pure Diagram → React Flow projection for Reader hosts.
 *
 * Draws the scene the diagram has open (`activeVersionId`), as the editor does:
 * a link shows the picture its author was looking at when they copied it, not
 * the base underneath. A host that must read the base — a walkthrough, whose
 * scripts were written against it — hands in the diagram without the field.
 * Everything else — what is shown (`resolveViewSnapshot`) and how it is drawn
 * (`projectDiagram`) — is the projection the editor runs, without the editor's
 * overlays, so a link draws what the author drew.
 *
 * `catalog` holds the names the diagram shows but does not own (see
 * `ReaderCatalog`).
 *
 * @example
 * const { nodes, edges } = projectReadDiagram(diagram, reading, { onPlayFlow });
 */
export function projectReadDiagram(
  diagram: Diagram,
  reading: ReadDiagramReading | null = null,
  routePlay: ReadDiagramRoutePlay | null = null,
  focusedNodeId: string | null = null,
  catalog: ReaderCatalog = EMPTY_READER_CATALOG,
): { nodes: Node[]; edges: Edge[] } {
  const { nodes, edges } = projectReadDiagramView(
    diagram,
    reading,
    routePlay,
    focusedNodeId,
    catalog,
  );
  return { nodes, edges };
}

/**
 * {@link projectReadDiagram}, handing back the view it projected as well:
 * `view.nodes[i]` is what `nodes[i]` was drawn from, for a host that lays its
 * own focus on top (see `withReaderFocus`).
 */
export function projectReadDiagramView(
  diagram: Diagram,
  reading: ReadDiagramReading | null = null,
  routePlay: ReadDiagramRoutePlay | null = null,
  focusedNodeId: string | null = null,
  catalog: ReaderCatalog = EMPTY_READER_CATALOG,
): { nodes: Node[]; edges: Edge[]; view: ViewSnapshot } {
  const view = resolveViewSnapshot(
    diagram,
    { versionId: diagram.activeVersionId ?? null },
    resolveNodeDescriptor,
  );
  const ctx = buildReadNodeContext(
    diagram,
    view.components,
    view.nodeLayouts,
    view.placedConnections,
    reading,
    routePlay?.onPlayFlow,
    focusedNodeId,
    catalog,
  );
  // Handle counts and assignments come from every placed connection — hidden
  // ends included, as in the editor — so each node renders the handles its
  // edges are assigned to.
  const handleAssignments = buildEdgeHandleAssignments(
    view.placedConnections,
    buildConnectionCountPerNode(view.placedConnections),
    view.components,
  );
  // The read policy locks the nodes — interaction flags and editing controls.
  const { nodes, edges } = projectDiagram(view, ctx, readPolicy(), {
    describe: resolveNodeDescriptor,
    handleAssignments,
  });
  return { nodes, edges, view };
}
