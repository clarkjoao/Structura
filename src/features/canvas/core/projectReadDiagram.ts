import type { Edge, Node } from "@xyflow/react";
import type { Component, Connection, Diagram } from "@/features/diagram/model";
import { resolveSceneSnapshot } from "@/features/diagram/utils";
import { buildEdge, filterVisibleConnections } from "../edges/data/buildEdges";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
} from "../edges/connectionDerivations";
import { EMPTY_FLOW_HIGHLIGHT } from "../flow/flowState";
import { resolveNodeDescriptor, type NodeBuildContext } from "../nodes/node-types";
import { buildCollapsedPanelIds, computeNodeVisibility } from "../nodes/nodeVisibility";
import { buildReadNodeContext, type ReadDiagramReading } from "./buildReadNodeContext";

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

function descriptorZIndex(
  component: Component,
  zIndex: number | ((comp: Component) => number),
): number {
  return typeof zIndex === "function" ? zIndex(component) : zIndex;
}

const NO_IDS: Set<string> = new Set();

function buildReadNode(
  component: Component,
  ctx: NodeBuildContext,
  collapsedPanelIds: Set<string>,
): Node {
  const descriptor = resolveNodeDescriptor(component);
  const layout = ctx.resolvedNodeLayouts[component.id];
  // The editor's own rule for who is shown and who is nested: a node under a
  // collapsed or hidden panel is hidden, and only a panel child is a child.
  const vis = computeNodeVisibility(
    component,
    descriptor,
    layout,
    ctx.panelIds,
    NO_IDS,
    NO_IDS,
    collapsedPanelIds,
    false,
    null,
    ctx.resolvedComponents,
  );
  return {
    id: component.id,
    type: descriptor.rfType,
    position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
    zIndex: descriptorZIndex(component, descriptor.zIndex),
    ...(vis.isChild ? { parentId: component.parentId!, extent: "parent" as const } : {}),
    hidden: vis.isHidden,
    draggable: false,
    selectable: false,
    connectable: false,
    data: lockForReading(descriptor.buildData(component, ctx)),
    style: descriptor.buildStyle?.(component, ctx),
  };
}

function sortComponentsTopologically(components: Component[]): Component[] {
  const idToComponent = new Map<string, Component>(components.map((c) => [c.id, c]));
  const visited = new Set<string>();
  const sorted: Component[] = [];

  function visit(component: Component): void {
    if (visited.has(component.id)) return;
    visited.add(component.id);
    if (component.parentId) {
      const parent = idToComponent.get(component.parentId);
      if (parent) visit(parent);
    }
    sorted.push(component);
  }

  for (const component of components) visit(component);
  return sorted;
}

/**
 * Pure Diagram → React Flow projection for Reader hosts.
 *
 * Always uses the base scene (`activeSceneId` ignored): a shared link must not
 * hide nodes a script may walk through.
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
  const resolvedSnapshot = resolveSceneSnapshot(diagram, null);
  // Same sets the editor builds (`useVisibleComponents` / `useVisibleConnections`):
  // a component with no layout is not on the canvas, nor is a connection to one.
  // Handle counts come from these connections — hidden ends included, as in the
  // editor — so every node renders the handles its edges are assigned to.
  const placedIds = new Set(Object.keys(resolvedSnapshot.nodeLayouts));
  const placedComponents = Object.values(resolvedSnapshot.components).filter((component) =>
    placedIds.has(component.id),
  );
  const connections = Object.values(resolvedSnapshot.connections).filter(
    (connection) => placedIds.has(connection.sourceId) && placedIds.has(connection.targetId),
  );
  const ctx = buildReadNodeContext(
    diagram,
    resolvedSnapshot.components,
    resolvedSnapshot.nodeLayouts,
    connections,
    reading,
    routePlay?.onPlayFlow,
    focusedNodeId,
  );
  const collapsedPanelIds = buildCollapsedPanelIds(resolvedSnapshot.components);
  const nodes = sortComponentsTopologically(placedComponents).map((component) =>
    buildReadNode(component, ctx, collapsedPanelIds),
  );

  const connectionCounts = buildConnectionCountPerNode(connections);
  const assignments = buildEdgeHandleAssignments(
    connections,
    connectionCounts,
    resolvedSnapshot.components,
  );
  const assignmentById = new Map(assignments.map((entry) => [entry.connId, entry]));
  // An edge to a hidden component is dropped; one into a collapsed panel stays
  // and React Flow hides it with its node — the editor's split exactly.
  const shownConnections = filterVisibleConnections(connections, resolvedSnapshot.components);
  const edges = shownConnections.map((connection: Connection) => {
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
