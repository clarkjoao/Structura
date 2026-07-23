import {
  diagramWithResolvedScene,
  EdgeMarker,
  EdgeStyle,
  getEffectiveConnectionStyle,
  isApiGroupComponent,
  isAwsComponent,
  isAzureComponent,
  isC4Component,
  isDbTableComponent,
  isEndpointComponent,
  isExternalElementComponent,
  isFlowNodeComponent,
  isGcpComponent,
  isJsonViewerComponent,
  isNoteComponent,
  isPanelComponent,
  isPluginTypedComponent,
  isSvgComponent,
  isUnknownComponent,
  StrokeStyle,
} from "@/features/diagram";
import type {
  Component,
  Connection,
  Diagram,
  DiagramModel,
  EdgeLayout,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import type {
  ExportEdge,
  ExportEdgeStyle,
  ExportMarker,
  ExportModel,
  ExportNode,
  ExportStrokeStyle,
} from "../export-core";
import { awsServiceCache } from "./aws-cache";
import { validateDiagram } from "./validate-diagram";

// --- source enum → neutral IR enum (exhaustive; a new enum value fails to compile) ---

function mapEdgeStyle(s: EdgeStyle): ExportEdgeStyle {
  switch (s) {
    case EdgeStyle.Smoothstep:
      return "smoothstep";
    case EdgeStyle.Step:
      return "step";
    case EdgeStyle.Bezier:
      return "bezier";
    case EdgeStyle.Straight:
      return "straight";
    case EdgeStyle.Editable:
      return "editable";
    case EdgeStyle.EditableStep:
      return "editable-step";
  }
}

function mapStroke(s: StrokeStyle): ExportStrokeStyle {
  switch (s) {
    case StrokeStyle.Solid:
      return "solid";
    case StrokeStyle.Dashed:
      return "dashed";
    case StrokeStyle.Dotted:
      return "dotted";
  }
}

function mapMarker(m: EdgeMarker): ExportMarker {
  switch (m) {
    case EdgeMarker.None:
      return "none";
    case EdgeMarker.Arrow:
      return "arrow";
    case EdgeMarker.ArrowClosed:
      return "arrow-closed";
  }
}

interface BaseGeometry {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

// C4 / GCP / Azure all render through the C4 cell (GCP/Azure fall back to system
// styling), so the mapper only needs this structural shape — not the named types
// (GcpComponent/AzureComponent are not exported from the diagram barrel).
function c4Node(
  c: { type: string; name: string; description: string; technology?: string; serviceId?: string },
  base: BaseGeometry,
  serviceCatalog: Record<string, ServiceDefinition>,
): ExportNode {
  const serviceName = c.serviceId ? serviceCatalog[c.serviceId]?.name : undefined;
  return {
    ...base,
    kind: "c4",
    subtype: c.type,
    name: c.name,
    description: c.description,
    technology: c.technology,
    serviceId: c.serviceId,
    serviceName,
  };
}

function mapNode(
  c: Component,
  nl: NodeLayout,
  serviceCatalog: Record<string, ServiceDefinition>,
): ExportNode {
  const base: BaseGeometry = {
    id: c.id,
    parentId: c.parentId,
    x: nl.x,
    y: nl.y,
    width: nl.width ?? 0,
    height: nl.height ?? 0,
  };

  if (isPanelComponent(c)) {
    return { ...base, kind: "panel", name: c.name, panelColor: c.panelColor };
  }
  if (isApiGroupComponent(c)) {
    return {
      ...base,
      kind: "apiGroup",
      serviceName: c.serviceName,
      basePath: c.basePath,
      protocol: c.protocol,
    };
  }
  if (isAwsComponent(c)) {
    return {
      ...base,
      kind: "aws",
      name: c.name,
      awsIcon: awsServiceCache.getInfo(c.awsService ?? "").icon,
    };
  }
  if (isC4Component(c)) {
    return c4Node(c, base, serviceCatalog);
  }
  if (isEndpointComponent(c)) {
    return {
      ...base,
      kind: "endpoint",
      method: c.method,
      path: c.path,
      endpointDescription: c.endpointDescription,
    };
  }
  if (isDbTableComponent(c)) {
    return {
      ...base,
      kind: "dbTable",
      tableName: c.tableName,
      columns: c.columns.map((col) => ({ name: col.name, dataType: col.dataType })),
    };
  }
  if (isJsonViewerComponent(c)) {
    return {
      ...base,
      kind: "jsonViewer",
      name: c.name,
      jsonContent: c.jsonContent,
      schemaRef: c.schemaRef,
    };
  }
  if (isNoteComponent(c)) {
    return { ...base, kind: "note", name: c.name, description: c.description };
  }
  if (isGcpComponent(c) || isAzureComponent(c)) {
    return c4Node(c, base, serviceCatalog);
  }
  if (
    isUnknownComponent(c) ||
    isSvgComponent(c) ||
    isFlowNodeComponent(c) ||
    isExternalElementComponent(c) ||
    isPluginTypedComponent(c)
  ) {
    throw new Error(`Unsupported component for draw.io export: ${c.type}`);
  }
  const _exhaustive: never = c;
  throw new Error(`Unsupported component for draw.io export: ${JSON.stringify(_exhaustive)}`);
}

function mapEdge(conn: Connection, edgeLayout: EdgeLayout | undefined): ExportEdge {
  const eff = getEffectiveConnectionStyle(conn);
  return {
    id: conn.id,
    sourceId: conn.sourceId,
    targetId: conn.targetId,
    label: conn.label,
    technology: conn.technology,
    intent: conn.intent,
    edgeStyle: mapEdgeStyle(conn.style?.edgeStyle ?? EdgeStyle.Smoothstep),
    strokeStyle: mapStroke(eff.strokeStyle ?? StrokeStyle.Solid),
    strokeWidth: eff.strokeWidth ?? 1,
    markerStart: mapMarker(eff.markerStart),
    markerEnd: mapMarker(eff.markerEnd),
    waypoints:
      edgeLayout?.points && edgeLayout.points.length > 0
        ? edgeLayout.points.map((p) => ({ x: p.x, y: p.y }))
        : undefined,
  };
}

function expandWithContainerAncestors(
  ids: string[],
  components: Record<string, Component>,
): string[] {
  const out = new Set(ids);
  for (const id of ids) {
    let p = components[id]?.parentId;
    while (p) {
      const parent = components[p];
      if (!parent) break;
      if (isPanelComponent(parent) || isApiGroupComponent(parent)) {
        out.add(p);
      }
      p = parent.parentId;
    }
  }
  return [...out];
}

/**
 * Build the neutral `ExportModel` for a diagram: resolves the active scene,
 * validates, applies an optional `componentIds` filter (keeping container
 * ancestors), and maps every laid-out component + connection into the IR.
 */
export function diagramToExportModel(
  diagram: Diagram | DiagramModel,
  serviceCatalog: Record<string, ServiceDefinition>,
  options?: { componentIds?: string[] },
): ExportModel {
  const resolved = diagramWithResolvedScene(diagram);
  validateDiagram(resolved);

  const shouldFilter = options?.componentIds !== undefined && options.componentIds.length > 0;

  const diagramForExport = shouldFilter
    ? (() => {
        const expandedIds = expandWithContainerAncestors(
          options!.componentIds!,
          resolved.snapshot.components,
        );
        const idSet = new Set(expandedIds);
        const filteredComponents = Object.fromEntries(
          Object.entries(resolved.snapshot.components).filter(([id]) => idSet.has(id)),
        );
        const filteredConnections = Object.fromEntries(
          Object.entries(resolved.snapshot.connections).filter(
            ([, conn]) => idSet.has(conn.sourceId) && idSet.has(conn.targetId),
          ),
        );
        return {
          ...resolved,
          snapshot: {
            ...resolved.snapshot,
            components: filteredComponents,
            connections: filteredConnections,
          },
          nodeLayouts: Object.fromEntries(
            Object.entries(resolved.nodeLayouts).filter(([id]) => idSet.has(id)),
          ),
          edgeLayouts: Object.fromEntries(
            Object.entries(resolved.edgeLayouts).filter(
              ([connectionId]) => filteredConnections[connectionId] !== undefined,
            ),
          ),
        };
      })()
    : resolved;

  const { components, connections } = diagramForExport.snapshot;
  const layoutMap = diagramForExport.nodeLayouts;
  const edgeLayouts = diagramForExport.edgeLayouts;

  const nodes: ExportNode[] = [];
  for (const id of Object.keys(components)) {
    const nl = layoutMap[id];
    if (!nl) continue;
    nodes.push(mapNode(components[id], nl, serviceCatalog));
  }

  const edges: ExportEdge[] = Object.values(connections).map((conn) =>
    mapEdge(conn, edgeLayouts[conn.id]),
  );

  return { name: diagramForExport.name, nodes, edges };
}
