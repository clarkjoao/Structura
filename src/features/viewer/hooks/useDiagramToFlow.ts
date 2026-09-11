import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { Component, Connection, Diagram } from "@/features/diagram/model";
import { resolveSceneSnapshot } from "@/features/diagram/utils";
import { resolveNodeDescriptor, type NodeBuildContext } from "@/features/canvas/nodes/node-types";
import { buildViewerNodeContext, type ViewerReading } from "./viewer-node-context";

export type { ViewerReading };

/**
 * How a reader starts a script from a route or group on the picture.
 */
export interface ViewerRoutePlay {
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

function buildViewerNode(component: Component, ctx: NodeBuildContext): Node {
  const descriptor = resolveNodeDescriptor(component);
  const layout = ctx.resolvedNodeLayouts[component.id];
  return {
    id: component.id,
    type: descriptor.rfType,
    position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
    zIndex: descriptorZIndex(component, descriptor.zIndex),
    ...(component.parentId ? { parentId: component.parentId, extent: "parent" as const } : {}),
    draggable: false,
    selectable: false,
    connectable: false,
    data: lockForReading(descriptor.buildData(component, ctx)),
    style: descriptor.buildStyle?.(component, ctx),
  };
}

function buildEdge(connection: Connection): Edge {
  return {
    id: connection.id,
    source: connection.sourceId,
    target: connection.targetId,
    type: "custom",
    selectable: false,
    data: {
      label: connection.label,
      technology: connection.technology,
      connectionId: connection.id,
      connectionStyle: connection.style,
      edgeStyle: connection.style?.edgeStyle,
      strokeStyle: connection.style?.strokeStyle,
      strokeWidth: connection.style?.strokeWidth,
      labelPosition: connection.style?.labelPosition,
    },
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

export function useDiagramToFlow(
  diagram: Diagram,
  reading: ViewerReading | null = null,
  routePlay: ViewerRoutePlay | null = null,
): {
  nodes: Node[];
  edges: Edge[];
} {
  return useMemo(() => {
    // The base, always. A reader arriving by link is not in the author's
    // scene: it hid nodes the script may walk through, said nothing, and
    // offered no way out. Links shared before that rule still carry
    // `activeSceneId`, so the viewer ignores it rather than trusting the
    // payload to be clean.
    const resolvedSnapshot = resolveSceneSnapshot(diagram, null);
    const visibleComponents = Object.values(resolvedSnapshot.components).filter(
      (component) => !component.hidden,
    );
    const ctx = buildViewerNodeContext(
      diagram,
      resolvedSnapshot.components,
      resolvedSnapshot.nodeLayouts,
      Object.values(resolvedSnapshot.connections),
      reading,
      routePlay?.onPlayFlow,
    );
    const nodes = sortComponentsTopologically(visibleComponents).map((component) =>
      buildViewerNode(component, ctx),
    );
    const edges = Object.values(resolvedSnapshot.connections).map(buildEdge);
    return { nodes, edges };
  }, [diagram, reading, routePlay]);
}
