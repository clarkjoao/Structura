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
  PanelKind,
  StrokeStyle,
} from "@/features/diagram";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import { DEFAULT_PANEL_OPACITY } from "@/features/canvas/constants/panel.constants";
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
import { resolveEdgeRouting } from "./edge-routing";
import type { HandleSlots } from "./edge-routing";

const MAX_HANDLES = 9; // Must match the canvas MAX_HANDLES constant

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

interface ConnectionCounts {
  incoming: number;
  outgoing: number;
}

/**
 * Compute absolute position of a node by accumulating its parent chain.
 * Returns the layout's x/y plus each ancestor's x/y.
 */
function getAbsoluteLayout(
  nodeId: string,
  layoutMap: Record<string, NodeLayout>,
  components: Record<string, Component>,
): { x: number; y: number; width: number; height: number } | undefined {
  const l = layoutMap[nodeId];
  const c = components[nodeId];
  if (!l) return undefined;
  let absX = l.x;
  let absY = l.y;
  let parentId = c?.parentId ?? null;
  while (parentId) {
    const pl = layoutMap[parentId];
    if (!pl) break;
    absX += pl.x;
    absY += pl.y;
    parentId = components[parentId]?.parentId ?? null;
  }
  return { x: absX, y: absY, width: l.width ?? 200, height: l.height ?? 120 };
}

/**
 * Count incoming and outgoing connections per node, matching the canvas logic.
 */
function buildConnectionCounts(connections: Connection[]): Record<string, ConnectionCounts> {
  const counts: Record<string, ConnectionCounts> = {};
  for (const conn of connections) {
    if (!counts[conn.sourceId]) counts[conn.sourceId] = { incoming: 0, outgoing: 0 };
    if (!counts[conn.targetId]) counts[conn.targetId] = { incoming: 0, outgoing: 0 };
    counts[conn.sourceId].outgoing += 1;
    counts[conn.targetId].incoming += 1;
  }
  return counts;
}

/**
 * Resolve the handle slot index for a connection, respecting handleOrder if present.
 * Mirrors the logic in connectionDerivations.ts for the canvas.
 */
function resolveHandleIndex(
  connId: string,
  order: string[] | undefined,
  usageCount: number,
  slotCount: number,
): number {
  if (order?.length) {
    const orderIdx = order.indexOf(connId);
    return orderIdx !== -1 ? Math.min(orderIdx, slotCount - 1) : usageCount % slotCount;
  }
  return usageCount % slotCount;
}

/**
 * Compute handle slots for each edge, matching how React Flow distributes handles
 * on the canvas. This is needed so multiple edges exiting/entering the same side
 * of a node get different anchor offsets in the draw.io export.
 */
function buildHandleSlots(
  connections: Connection[],
  components: Record<string, Component>,
): Map<string, HandleSlots> {
  const counts = buildConnectionCounts(connections);
  const slots = new Map<string, HandleSlots>();
  const sourceUsage: Record<string, number> = {};
  const targetUsage: Record<string, number> = {};

  for (const conn of connections) {
    const srcComp = components[conn.sourceId];
    const tgtComp = components[conn.targetId];

    // Determine slot counts (same logic as canvas)
    const outCount = Math.min(MAX_HANDLES, Math.max(1, counts[conn.sourceId]?.outgoing ?? 1));

    // Single incoming handle for notes, db tables, json viewers
    const isSingleIncomingTarget =
      tgtComp !== undefined &&
      (isNoteComponent(tgtComp) || isDbTableComponent(tgtComp) || isJsonViewerComponent(tgtComp));
    const inCount = isSingleIncomingTarget
      ? 1
      : Math.min(MAX_HANDLES, Math.max(1, counts[conn.targetId]?.incoming ?? 1));

    // Get handle order from components
    const srcOrder = srcComp?.handleOrder?.outgoing;
    const tgtOrder = tgtComp?.handleOrder?.incoming;

    const sIdx = resolveHandleIndex(conn.id, srcOrder, sourceUsage[conn.sourceId] ?? 0, outCount);
    const tIdx = resolveHandleIndex(conn.id, tgtOrder, targetUsage[conn.targetId] ?? 0, inCount);

    sourceUsage[conn.sourceId] = (sourceUsage[conn.sourceId] ?? 0) + 1;
    targetUsage[conn.targetId] = (targetUsage[conn.targetId] ?? 0) + 1;

    slots.set(conn.id, {
      sourceSlot: sIdx,
      targetSlot: tIdx,
      sourceCount: outCount,
      targetCount: inCount,
    });
  }

  return slots;
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
    const kindDef = getPanelKindDef(c.panelKind);
    // Swimlanes get their own IR kind so the drawio cell builder emits the
    // `swimlane;horizontal=N` shape instead of a generic panel rectangle.
    if (c.panelKind === PanelKind.Swimlane) {
      const sl = c.swimlane;
      const orientation = sl?.orientation ?? "horizontal";
      const laneColor = sl?.laneColor ?? c.panelColor ?? kindDef.defaultColor ?? "#6366f1";
      const laneLabel = sl?.laneLabel ?? c.name;
      return {
        ...base,
        kind: "swimlane",
        name: c.name,
        laneColor,
        laneLabel,
        orientation,
        opacity: sl?.opacity ?? c.panelOpacity ?? DEFAULT_PANEL_OPACITY,
      };
    }
    return {
      ...base,
      kind: "panel",
      name: c.name,
      panelColor: c.panelColor,
      panelKindDefaultColor: kindDef.defaultColor,
      panelOpacity: c.panelOpacity ?? DEFAULT_PANEL_OPACITY,
      borderStyle: c.borderStyle ?? "solid",
    };
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

function mapEdge(
  conn: Connection,
  edgeLayout: EdgeLayout | undefined,
  layoutMap: Record<string, NodeLayout>,
  components: Record<string, Component>,
  slot: HandleSlots | undefined,
): ExportEdge {
  const eff = getEffectiveConnectionStyle(conn);

  // Resolve routing: handle positions (with slot offsets), sides, and waypoints.
  // Uses absolute coordinates and matches the canvas routing exactly.
  const routing = resolveEdgeRouting(
    conn.sourceId,
    conn.targetId,
    layoutMap,
    components,
    edgeLayout,
    slot,
  );

  // Compute normalised draw.io anchor values from absolute handle positions.
  // This is where slot offsets are applied: multiple handles on the same side
  // of a node each get a different exitY/entryY, so edges don't collapse.
  const srcAbsLayout = getAbsoluteLayout(conn.sourceId, layoutMap, components);
  const tgtAbsLayout = getAbsoluteLayout(conn.targetId, layoutMap, components);
  const srcH = srcAbsLayout?.height ?? 120;
  const tgtW = tgtAbsLayout?.width ?? 200;

  // Normalise absolute handle Y to [0, 1] relative to source node height
  const exitY =
    routing.sides.sourcePosition === "right" || routing.sides.sourcePosition === "left"
      ? (routing.sourceAbs.y - (srcAbsLayout?.y ?? 0)) / srcH
      : routing.sides.exitY;

  // Normalise absolute handle X to [0, 1] relative to target node width
  const entryX =
    routing.sides.targetPosition === "top" || routing.sides.targetPosition === "bottom"
      ? (routing.targetAbs.x - (tgtAbsLayout?.x ?? 0)) / tgtW
      : routing.sides.entryX;

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
    waypoints: routing.waypoints,
    exitX: routing.sides.exitX,
    exitY,
    entryX,
    entryY: routing.sides.entryY,
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

  // Compute handle slots for all edges BEFORE mapping edges
  const handleSlots = buildHandleSlots(Object.values(connections), components);

  const nodes: ExportNode[] = [];
  for (const id of Object.keys(components)) {
    const nl = layoutMap[id];
    if (!nl) continue;
    nodes.push(mapNode(components[id], nl, serviceCatalog));
  }

  const edges: ExportEdge[] = Object.values(connections).map((conn) =>
    mapEdge(conn, edgeLayouts[conn.id], layoutMap, components, handleSlots.get(conn.id)),
  );

  return { name: diagramForExport.name, nodes, edges };
}
