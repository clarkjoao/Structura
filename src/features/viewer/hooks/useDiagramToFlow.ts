import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import {
  isApiGroupComponent,
  isDbTableComponent,
  isEndpointComponent,
  isJsonViewerComponent,
  isNoteComponent,
  isPanelComponent,
  type Component,
  type Connection,
  type Diagram,
  type NodeLayout,
} from "@/features/diagram/model";
import { resolveSceneSnapshot } from "@/features/diagram/utils";
import { DB_TABLE_COLLAPSED_H } from "@/features/canvas/canvas.constants";
import {
  flowPlaybackOpacity,
  type FlowBadges,
  type FlowHighlight,
} from "@/features/canvas/flow/flowState";

/**
 * The script being read, as the canvas needs it.
 *
 * `null` while nothing is open — and then the canvas carries no numbers at
 * all, because the open script is what numbers it.
 */
export interface ViewerReading {
  badges: FlowBadges | null;
  highlight: FlowHighlight;
}

function resolveNodeType(component: Component): string {
  if (isPanelComponent(component)) {
    return component.panelKind === "swimlane" ? "swimlane" : "panel";
  }
  if (isNoteComponent(component)) return "note";
  if (isApiGroupComponent(component)) return "api-group";
  if (isEndpointComponent(component)) return "endpoint";
  if (isDbTableComponent(component)) return "db-table";
  if (isJsonViewerComponent(component)) return "json-viewer";
  return "c4";
}

function buildNodeData(
  component: Component,
  reading: ViewerReading | null,
): Record<string, unknown> {
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

  if (isDbTableComponent(component)) {
    return {
      elementId: component.id,
      tableName: component.tableName || component.name,
      columns: component.columns.map((col) => ({
        id: col.id,
        name: col.name,
        dataType: col.dataType,
        isPrimaryKey: col.isPrimaryKey ?? false,
        isForeignKey: col.isForeignKey ?? false,
        nullable: col.nullable ?? true,
        unique: col.unique ?? false,
      })),
      isSelected: false,
      collapsed: component.collapsed ?? false,
      onToggleCollapse: () => {},
      onCommit: () => {},
    };
  }

  if (isJsonViewerComponent(component)) {
    return {
      elementId: component.id,
      name: component.name,
      jsonContent: component.jsonContent,
      schemaRef: component.schemaRef,
      isSelected: false,
      layoutWidth: 240,
      layoutHeight: 88,
    };
  }

  return {
    elementId: component.id,
    stepBadges: reading?.badges?.nodeLabels.get(component.id),
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
  reading: ViewerReading | null,
): Node {
  const layout = nodeLayouts[component.id];
  const dbTableFixedH = 32 + 22 + 20 + 2;
  const dbTableRowH = 24;
  const width = isDbTableComponent(component)
    ? (layout?.width ?? 406)
    : isJsonViewerComponent(component)
      ? (layout?.width ?? 240)
      : (layout?.width ?? 260);
  const height = isDbTableComponent(component)
    ? component.collapsed
      ? DB_TABLE_COLLAPSED_H
      : dbTableFixedH + component.columns.length * dbTableRowH
    : isJsonViewerComponent(component)
      ? (layout?.height ?? 88)
      : (layout?.height ?? 120);

  return {
    id: component.id,
    type: resolveNodeType(component),
    position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
    ...(component.parentId ? { parentId: component.parentId, extent: "parent" as const } : {}),
    draggable: false,
    selectable: false,
    connectable: false,
    data: buildNodeData(component, reading),
    style: {
      width,
      height,
      ...(reading ? { opacity: flowPlaybackOpacity(component.id, reading.highlight) } : {}),
    },
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

  for (const component of components) {
    visit(component);
  }

  return sorted;
}

export function useDiagramToFlow(
  diagram: Diagram,
  reading: ViewerReading | null = null,
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

    const sortedComponents = sortComponentsTopologically(visibleComponents);

    const nodes = sortedComponents.map((component) =>
      buildNode(component, resolvedSnapshot.nodeLayouts, reading),
    );

    const edges = Object.values(resolvedSnapshot.connections).map(buildEdge);

    return { nodes, edges };
  }, [diagram, reading]);
}
