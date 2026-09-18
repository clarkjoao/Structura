import type { Edge, Node } from "@xyflow/react";
import type { Connection, Diagram } from "@/features/diagram/model";
import { buildEdge } from "../edges/data/buildEdges";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
} from "../edges/connectionDerivations";
import { EMPTY_FLOW_HIGHLIGHT } from "../flow/flowState";
import { resolveNodeDescriptor, type NodeBuildContext } from "../nodes/node-types";
import { buildReadNodeContext, type ReadDiagramReading } from "./buildReadNodeContext";
import { resolveViewSnapshot, type ViewNode } from "./resolveViewSnapshot";

export type { ReadDiagramReading };

/** How a reader starts a script from a route or group on the picture. */
export interface ReadDiagramRoutePlay {
  onPlayFlow: (flowId: string) => void;
}

function lockForReading(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    controlsDisabled: true,
    onDrillDown: undefined,
    onEmbed: undefined,
    onReorderHandle: undefined,
    onAddEndpoint: undefined,
    onOpenInCanvas: undefined,
    onInlineEditingChange: undefined,
  };
}

function buildReadNode(view: ViewNode, ctx: NodeBuildContext): Node {
  const { component, layout } = view;
  const descriptor = resolveNodeDescriptor(component);
  return {
    id: component.id,
    type: descriptor.rfType,
    position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
    zIndex: view.zIndex,
    ...(view.isChild ? { parentId: component.parentId!, extent: "parent" as const } : {}),
    hidden: view.isHidden,
    draggable: false,
    selectable: false,
    connectable: false,
    data: lockForReading(descriptor.buildData(component, ctx)),
    style: descriptor.buildStyle?.(component, ctx),
  };
}

/**
 * Pure Diagram → React Flow projection for Reader hosts.
 *
 * Always uses the base scene (`activeSceneId` ignored): a shared link must not
 * hide nodes a script may walk through. Everything else about what is shown —
 * placement, nesting, stacking, hiding, order — is `resolveViewSnapshot`, the
 * same rule the editor runs, so a link draws what the author drew.
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
  const nodes = view.nodes.map((node) => buildReadNode(node, ctx));

  // Handle counts and assignments come from every placed connection — hidden
  // ends included, as in the editor — so each node renders the handles its
  // edges are assigned to; only the shown ones become edges.
  const connectionCounts = buildConnectionCountPerNode(view.placedConnections);
  const assignments = buildEdgeHandleAssignments(
    view.placedConnections,
    connectionCounts,
    view.components,
  );
  const assignmentById = new Map(assignments.map((entry) => [entry.connId, entry]));
  // An edge to a hidden component is dropped; one into a collapsed panel stays
  // and React Flow hides it with its node — the editor's split exactly.
  const edges = view.shownConnections.map((connection: Connection) => {
    const edge = buildEdge(connection, assignmentById.get(connection.id), {
      diagram,
      selectedEdgeId: null,
      isPlaying: Boolean(reading),
      isRecording: false,
      activeStep: null,
      flowHighlight: reading?.highlight ?? EMPTY_FLOW_HIGHLIGHT,
      flowBadges: reading?.badges ?? null,
      coverage: null,
      // Links shared before `edgeLayouts` existed arrive without it; an empty map
      // still stamps every edge, so none falls back to the store.
      edgeLayouts: diagram.edgeLayouts ?? {},
    });
    return { ...edge, selectable: false };
  });

  return { nodes, edges };
}
