import {
  diagramWithResolvedScene,
  EdgeMarker,
  EdgeStyle,
  getEffectiveConnectionStyle,
  isApiGroupComponent,
  isDbTableComponent,
  isNoteComponent,
  isPanelComponent,
  isJsonViewerComponent,
  isPluginTypedComponent,
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
import { getElement, isRegisteredElementComponent } from "@/features/elements/element.registry";
import { validateDiagram } from "./validate-diagram";
import { MAX_HANDLES } from "@/features/diagram/model/layout.constants";
import { edgeSides, resolveEdgeRouting } from "./edge-routing";
import type { HandleSlots } from "./edge-routing";

/**
 * The canvas's own cap, imported rather than copied.
 *
 * It was a local `9` under a comment claiming it matched the canvas, which has
 * been 4. The number decides the anchor height — slot `i` of `n` sits at
 * `(i + 1) / (n + 1)` of the node — so a node with four outgoing edges put its
 * anchors at 20/40/60/80% on screen and at 10/20/30/40% in every export.
 *
 * The leaf constants module, not `@/features/diagram`: the export service must
 * not pull the store into its import graph.
 */

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
    case EdgeStyle.Zigzag:
      return "zigzag";
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

/** Whether the component's type declares the flowchart shapes' vertical handles. */
function hasVerticalSides(component: Component | undefined): boolean {
  return !!component && getElement(component.type)?.canvas.handles.verticalSides === true;
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

    // Determine slot counts (same logic as canvas). A flowchart shape has one
    // handle a side, in the middle, whatever its edge count.
    const outCount = hasVerticalSides(srcComp)
      ? 1
      : Math.min(MAX_HANDLES, Math.max(1, counts[conn.sourceId]?.outgoing ?? 1));

    // Single incoming handle for notes, db tables, json viewers
    const isSingleIncomingTarget =
      tgtComp !== undefined &&
      (isNoteComponent(tgtComp) || isDbTableComponent(tgtComp) || isJsonViewerComponent(tgtComp));
    const inCount =
      isSingleIncomingTarget || hasVerticalSides(tgtComp)
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

function mapNode(
  c: Component,
  nl: NodeLayout,
  services: Record<string, ServiceDefinition>,
): ExportNode {
  const base: BaseGeometry = {
    id: c.id,
    parentId: c.parentId,
    x: nl.x,
    y: nl.y,
    width: nl.width ?? 0,
    height: nl.height ?? 0,
  };

  // Registered elements declare their own draw.io mapping (decision 6); the
  // guard chain below still owns every type that has not migrated.
  if (isRegisteredElementComponent(c)) {
    const node = getElement(c.type)!.export.drawio.toExportNode(c, base);
    // Business-catalog service names live outside the descriptor contract; the
    // adapter fills them in for C4 cards the way the legacy branch did.
    if (node.kind === "c4" && node.serviceId) {
      return {
        ...node,
        serviceName: services[node.serviceId]?.name,
      };
    }
    return node;
  }

  // Only plugin types can still reach this: every built-in element declares
  // its own draw.io mapping on the registry. A plugin contributing an exporter
  // is its own extension point (`registerExporter`), not this switch.
  if (isPluginTypedComponent(c)) {
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
    edgeSides(
      conn.sourceSide === "bottom" && hasVerticalSides(components[conn.sourceId]),
      conn.targetSide === "top" && hasVerticalSides(components[conn.targetId]),
    ),
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
  services: Record<string, ServiceDefinition>,
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
    nodes.push(mapNode(components[id], nl, services));
  }

  const edges: ExportEdge[] = Object.values(connections).map((conn) =>
    mapEdge(conn, edgeLayouts[conn.id], layoutMap, components, handleSlots.get(conn.id)),
  );

  return { name: diagramForExport.name, nodes, edges };
}
