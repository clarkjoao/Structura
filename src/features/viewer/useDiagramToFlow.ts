import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import {
  isApiGroupComponent,
  isEndpointComponent,
  isNoteComponent,
  isPanelComponent,
  resolveSceneSnapshot,
  type Component,
  type Connection,
  type Diagram,
  type NodeLayout,
} from "@/features/diagram";

function resolveNodeType(component: Component): string {
  if (isPanelComponent(component)) {
    return component.panelKind === "swimlane" ? "swimlane" : "panel";
  }
  if (isNoteComponent(component)) return "note";
  if (isApiGroupComponent(component)) return "api-group";
  if (isEndpointComponent(component)) return "endpoint";
  return "c4";
}

function buildNodeData(component: Component): Record<string, unknown> {
  if (isPanelComponent(component)) {
    return {
      elementId: component.id,
      name: component.name,
      description: component.description,
      panelKind: component.panelKind,
      panelColor: component.panelColor,
      panelOpacity: component.panelOpacity,
      borderStyle: component.borderStyle,
      collapsed: component.collapsed ?? false,
      isSelected: false,
      childCount: 0,
    };
  }

  if (isNoteComponent(component)) {
    return {
      elementId: component.id,
      name: component.name,
      description: component.description,
      panelColor: component.panelColor,
      collapsed: component.collapsed ?? false,
      isSelected: false,
    };
  }

  if (isApiGroupComponent(component)) {
    return {
      elementId: component.id,
      serviceName: component.serviceName,
      basePath: component.basePath,
      protocol: component.protocol,
      sla: component.sla,
      isSelected: false,
      controlsDisabled: true,
    };
  }

  if (isEndpointComponent(component)) {
    return {
      elementId: component.id,
      method: component.method,
      path: component.path,
      description: component.endpointDescription ?? component.description,
      handlers: component.handlers ?? [],
      isSelected: false,
      controlsDisabled: true,
    };
  }

  return {
    elementId: component.id,
    name: component.name,
    type: component.type,
    description: component.description,
    technology: "technology" in component ? component.technology : undefined,
    awsService: "awsService" in component ? component.awsService : undefined,
    customColor: "panelColor" in component ? component.panelColor : undefined,
    isSelected: false,
    controlsDisabled: true,
    incomingCount: 1,
    outgoingCount: 1,
    handleOrder: component.handleOrder,
  };
}

function buildNode(
  component: Component,
  nodeLayouts: Record<string, NodeLayout>,
): Node {
  const layout = nodeLayouts[component.id];
  const width = layout?.width ?? 260;
  const height = layout?.height ?? 120;

  return {
    id: component.id,
    type: resolveNodeType(component),
    position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
    ...(component.parentId
      ? { parentId: component.parentId, extent: "parent" as const }
      : {}),
    draggable: false,
    selectable: false,
    connectable: false,
    data: buildNodeData(component),
    style: { width, height },
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
  const idToComponent = new Map<string, Component>(
    components.map((c) => [c.id, c]),
  );

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

  for (const component of components) {
    visit(component);
  }

  return sorted;
}

export function useDiagramToFlow(diagram: Diagram): {
  nodes: Node[];
  edges: Edge[];
} {
  return useMemo(() => {
    const resolvedSnapshot = resolveSceneSnapshot(
      diagram,
      diagram.activeSceneId ?? null,
    );

    const visibleComponents = Object.values(resolvedSnapshot.components).filter(
      (component) => !component.hidden,
    );

    const sortedComponents = sortComponentsTopologically(visibleComponents);

    const nodes = sortedComponents.map((component) =>
      buildNode(component, resolvedSnapshot.nodeLayouts),
    );

    const edges = Object.values(resolvedSnapshot.connections).map(buildEdge);

    return { nodes, edges };
  }, [diagram]);
}
