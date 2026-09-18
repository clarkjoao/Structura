import type { Edge, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
} from "../edges/connectionDerivations";
import { resolveNodeDescriptor } from "../nodes/node-types";
import { buildReadNodeContext, type ReadDiagramReading } from "./buildReadNodeContext";
import { readPolicy } from "./canvasInteractionPolicy";
import { projectDiagram } from "./projectDiagram";
import { resolveViewSnapshot } from "./resolveViewSnapshot";

export type { ReadDiagramReading };

/** How a reader starts a script from a route or group on the picture. */
export interface ReadDiagramRoutePlay {
  onPlayFlow: (flowId: string) => void;
}

/**
 * Pure Diagram → React Flow projection for Reader hosts.
 *
 * Always uses the base scene (`activeSceneId` ignored): a shared link must not
 * hide nodes a script may walk through. Everything else — what is shown
 * (`resolveViewSnapshot`) and how it is drawn (`projectDiagram`) — is the
 * projection the editor runs, without the editor's overlays, so a link draws
 * what the author drew.
 *
 * @example
 * const { nodes, edges } = projectReadDiagram(diagram, reading, { onPlayFlow });
 */
export function projectReadDiagram(
  diagram: Diagram,
  reading: ReadDiagramReading | null = null,
  routePlay: ReadDiagramRoutePlay | null = null,
  focusedNodeId: string | null = null,
): { nodes: Node[]; edges: Edge[] } {
  const view = resolveViewSnapshot(diagram, { sceneId: null }, resolveNodeDescriptor);
  const ctx = buildReadNodeContext(
    diagram,
    view.components,
    view.nodeLayouts,
    view.placedConnections,
    reading,
    routePlay?.onPlayFlow,
    focusedNodeId,
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
  return projectDiagram(view, ctx, readPolicy(), {
    describe: resolveNodeDescriptor,
    handleAssignments,
  });
}
