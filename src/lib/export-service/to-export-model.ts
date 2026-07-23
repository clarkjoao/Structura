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

interface HandleSlots {
  sourceSlot: number;
  targetSlot: number;
  sourceCount: number;
  targetCount: number;
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
    const outCount = Math.min(
      MAX_HANDLES,
      Math.max(1, counts[conn.sourceId]?.outgoing ?? 1),
    );

    // Single incoming handle for notes, db tables, json viewers
    const isSingleIncomingTarget =
      tgtComp !== undefined &&
      (isNoteComponent(tgtComp) ||
        isDbTableComponent(tgtComp) ||
        isJsonViewerComponent(tgtComp));
    const inCount = isSingleIncomingTarget
      ? 1
      : Math.min(MAX_HANDLES, Math.max(1, counts[conn.targetId]?.incoming ?? 1));

    // Get handle order from components
    const srcOrder = srcComp?.handleOrder?.outgoing;
    const tgtOrder = tgtComp?.handleOrder?.incoming;

    const sIdx = resolveHandleIndex(
      conn.id,
      srcOrder,
      sourceUsage[conn.sourceId] ?? 0,
      outCount,
    );
    const tIdx = resolveHandleIndex(
      conn.id,
      tgtOrder,
      targetUsage[conn.targetId] ?? 0,
      inCount,
    );

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

/**
 * Convert a handle slot index to a normalized anchor offset.
 * For N slots on a side, slot i gets position (i+1)/(N+1).
 * This matches how React Flow's buildHandles distributes handles visually.
 */
function slotToOffset(slot: number, count: number): number {
  if (count <= 1) return 0.5;
  return (slot + 1) / (count + 1);
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

/**
 * Infer exit/entry anchors from the relative geometry of source and target
 * nodes, with slot-based offsets for multiple handles on the same side.
 *
 * For horizontal flows (right→left default): exitX=1, entryX=0.
 * For vertical flows: use top/bottom anchors so the line runs directly.
 *
 * When multiple edges share the same side, slot offsets distribute them
 * proportionally: slot i of N gets position (i+1)/(N+1), mirroring the
 * canvas React Flow behavior.
 *
 * For container/panel targets: entry anchor is chosen based on where the
 * source is relative to the container, so the line enters from the correct side.
 */
function inferAnchors(
  sourceId: string,
  targetId: string,
  layoutMap: Record<string, NodeLayout>,
  components: Record<string, Component>,
  slot: HandleSlots | undefined,
): { exitX: number; exitY: number; entryX: number; entryY: number } {
  const src = layoutMap[sourceId];
  const tgt = layoutMap[targetId];
  if (!src || !tgt) {
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }

  const srcW = src.width ?? 200;
  const srcH = src.height ?? 120;
  const tgtW = tgt.width ?? 200;
  const tgtH = tgt.height ?? 120;

  const srcCenterX = src.x + srcW / 2;
  const srcCenterY = src.y + srcH / 2;
  const tgtCenterX = tgt.x + tgtW / 2;
  const tgtCenterY = tgt.y + tgtH / 2;

  const dx = tgtCenterX - srcCenterX;
  const dy = tgtCenterY - srcCenterY;

  // Determine base anchor positions based on geometry
  let baseExitX = 1; // right side of source
  let baseExitY = 0.5;
  let baseEntryX = 0; // left side of target
  let baseEntryY = 0.5;

  // Vertical-dominant: target sits clearly above or below the source.
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
    if (dy > 0) {
      // Target below source: exit bottom, enter top.
      baseExitX = 0.5;
      baseExitY = 1;
      baseEntryX = 0.5;
      baseEntryY = 0;
    } else {
      // Target above source: exit top, enter bottom.
      baseExitX = 0.5;
      baseExitY = 0;
      baseEntryX = 0.5;
      baseEntryY = 1;
    }
  }

  // For container/panel targets: choose entry side based on source position
  const tgtComp = components[targetId];
  if (tgtComp && (isPanelComponent(tgtComp) || isApiGroupComponent(tgtComp))) {
    // If source is to the left of container, enter from the left
    // If source is to the right of container, enter from the right
    // If source is above container, enter from top
    // If source is below container, enter from bottom
    const tgtLeft = tgt.x;
    const tgtRight = tgt.x + tgtW;
    const tgtTop = tgt.y;
    const tgtBottom = tgt.y + tgtH;

    if (srcCenterX < tgtLeft) {
      // Source is to the left
      baseEntryX = 0;
      baseEntryY = 0.5;
    } else if (srcCenterX > tgtRight) {
      // Source is to the right
      baseEntryX = 1;
      baseEntryY = 0.5;
    } else if (srcCenterY < tgtTop) {
      // Source is above
      baseEntryX = 0.5;
      baseEntryY = 0;
    } else if (srcCenterY > tgtBottom) {
      // Source is below
      baseEntryX = 0.5;
      baseEntryY = 1;
    }
    // Otherwise, keep horizontal default (left side)
  }

  // Apply slot offsets when there are multiple handles on the same side
  if (slot) {
    // Source handle offset
    if (slot.sourceCount > 1) {
      const offset = slotToOffset(slot.sourceSlot, slot.sourceCount);
      if (baseExitY === 0.5) {
        // Horizontal: offset along the right side (Y axis)
        baseExitY = offset;
      }
      // For vertical exits (top/bottom), offset would be along X axis
      // but we keep exitX=0.5 for vertical exits
    }

    // Target handle offset
    if (slot.targetCount > 1) {
      const offset = slotToOffset(slot.targetSlot, slot.targetCount);
      if (baseEntryY === 0.5) {
        // Horizontal: offset along the left side (Y axis)
        baseEntryY = offset;
      }
      // For vertical entries (top/bottom), offset would be along X axis
      // but we keep entryX=0.5 for vertical entries
    }
  }

  return {
    exitX: baseExitX,
    exitY: baseExitY,
    entryX: baseEntryX,
    entryY: baseEntryY,
  };
}

/**
 * When source and target are siblings inside the same container panel / api-group,
 * other siblings may sit between them.  The automatic orthogonal router has no
 * knowledge of those obstacles, so it routes straight through them.
 *
 * This function detects the common-ancestor container (panel / api-group) of both
 * ends, computes the bounding box of all *other* children inside it, and returns
 * a set of waypoints that route the edge around that occupied space while
 * staying inside the container perimeter.  The result is merged with any
 * user-authored waypoints in edgeLayout.points (user edits always win).
 *
 * The waypoints are placed just inside the container boundary (margin=1) so they
 * do not clip against the panel outline.
 */
function buildContainerWaypoints(
  sourceId: string,
  targetId: string,
  components: Record<string, Component>,
  layoutMap: Record<string, NodeLayout>,
): { x: number; y: number }[] | undefined {
  const srcComp = components[sourceId];
  const tgtComp = components[targetId];
  if (!srcComp || !tgtComp) return undefined;

  // Find the nearest common container ancestor (panel or api-group).
  const srcAncestors = new Set<string>();
  let p = srcComp.parentId;
  while (p) {
    srcAncestors.add(p);
    p = components[p]?.parentId;
  }

  let containerId: string | null = null;
  p = tgtComp.parentId;
  while (p) {
    if (srcAncestors.has(p) && (isPanelComponent(components[p]) || isApiGroupComponent(components[p]))) {
      containerId = p;
      break;
    }
    p = components[p]?.parentId;
  }

  if (!containerId) return undefined;

  const containerLayout = layoutMap[containerId];
  const srcLayout = layoutMap[sourceId];
  const tgtLayout = layoutMap[targetId];
  if (!containerLayout || !srcLayout || !tgtLayout) return undefined;

  // Minimum margin from container edge to waypoint (pixels).
  // This ensures waypoints never clip against the panel outline.
  const MARGIN = 5;
  const cLeft = containerLayout.x + MARGIN;
  const cTop = containerLayout.y + MARGIN;
  const cRight = containerLayout.x + (containerLayout.width ?? 200) - MARGIN;
  const cBottom = containerLayout.y + (containerLayout.height ?? 120) - MARGIN;

  // Bounding box of every OTHER sibling inside the container (excluding src + tgt).
  let occMinX = Infinity,
    occMinY = Infinity,
    occMaxX = -Infinity,
    occMaxY = -Infinity;
  let hasOccupied = false;

  for (const [id, comp] of Object.entries(components)) {
    if (id === sourceId || id === targetId || id === containerId) continue;
    if (comp.parentId !== containerId) continue;
    const l = layoutMap[id];
    if (!l) continue;
    const w = l.width ?? 0;
    const h = l.height ?? 0;
    occMinX = Math.min(occMinX, l.x);
    occMinY = Math.min(occMinY, l.y);
    occMaxX = Math.max(occMaxX, l.x + w);
    occMaxY = Math.max(occMaxY, l.y + h);
    hasOccupied = true;
  }

  if (!hasOccupied) return undefined;

  // Clamp to container bounds.
  occMinX = Math.max(occMinX, cLeft);
  occMinY = Math.max(occMinY, cTop);
  occMaxX = Math.min(occMaxX, cRight);
  occMaxY = Math.min(occMaxY, cBottom);

  if (occMinX >= occMaxX || occMinY >= occMaxY) return undefined;

  // Build per-box array for intersection testing.
  interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const occupiedBoxes: Box[] = [];
  for (const [id, comp] of Object.entries(components)) {
    if (id === sourceId || id === targetId || id === containerId) continue;
    if (comp.parentId !== containerId) continue;
    const l = layoutMap[id];
    if (!l) continue;
    const w = l.width ?? 0;
    const h = l.height ?? 0;
    occupiedBoxes.push({ x: l.x, y: l.y, w, h });
  }

  // Entry / exit midpoints.
  const sRight = srcLayout.x + (srcLayout.width ?? 200);
  const sMidY = srcLayout.y + (srcLayout.height ?? 120) / 2;
  const tLeft = tgtLayout.x;
  const tMidY = tgtLayout.y + (tgtLayout.height ?? 120) / 2;

  // Helper: does a horizontal band (at y=midY, x from a→b) intersect any occupied box?
  function hBandBlocked(a: number, b: number, midY: number): boolean {
    for (const box of occupiedBoxes) {
      if (box.y <= midY && midY <= box.y + box.h) {
        if (Math.max(a, box.x) < Math.min(b, box.x + box.w)) return true;
      }
    }
    return false;
  }

  // Helper: does a vertical band (at x=midX, y from a→b) intersect any occupied box?
  function vBandBlocked(a: number, b: number, midX: number): boolean {
    for (const box of occupiedBoxes) {
      if (box.x <= midX && midX <= box.x + box.w) {
        if (Math.max(a, box.y) < Math.min(b, box.y + box.h)) return true;
      }
    }
    return false;
  }

  // ── Rightward target ─────────────────────────────────────────────────────
  if (sRight < tLeft) {
    if (!hBandBlocked(sRight, tLeft, sMidY)) return undefined; // direct path clear
    // Route below the occupied boxes, clamped to container bounds.
    const viaY = Math.min(occMaxY + MARGIN, cBottom);
    const viaX = Math.min(occMaxX + MARGIN, cRight);
    return [
      { x: sRight, y: sMidY },
      { x: viaX, y: sMidY },
      { x: viaX, y: viaY },
      { x: tLeft, y: viaY },
      { x: tLeft, y: tMidY },
    ];
  }

  // ── Leftward target ────────────────────────────────────────────────────────
  if (tLeft < sRight) {
    if (!hBandBlocked(tLeft, sRight, sMidY)) return undefined;
    // Route above the occupied boxes, clamped to container bounds.
    const viaY = Math.max(occMinY - MARGIN, cTop);
    const viaX = Math.max(occMinX - MARGIN, cLeft);
    return [
      { x: sRight, y: sMidY },
      { x: viaX, y: sMidY },
      { x: viaX, y: viaY },
      { x: tLeft, y: viaY },
      { x: tLeft, y: tMidY },
    ];
  }

  // ── Vertical: target below source ─────────────────────────────────────────
  if (sMidY < tMidY) {
    if (!vBandBlocked(sMidY, tMidY, tLeft)) return undefined;
    // Route around the right side of the occupied space, clamped to container bounds.
    const viaX = Math.min(occMaxX + MARGIN, cRight);
    return [
      { x: sRight, y: sMidY },
      { x: viaX, y: sMidY },
      { x: viaX, y: tMidY },
      { x: tLeft, y: tMidY },
    ];
  }

  // ── Vertical: target above source ─────────────────────────────────────────
  if (!vBandBlocked(tMidY, sMidY, tLeft)) return undefined;
  // Route around the left side of the occupied space, clamped to container bounds.
  const viaX = Math.max(occMinX - MARGIN, cLeft);
  return [
    { x: sRight, y: sMidY },
    { x: viaX, y: sMidY },
    { x: viaX, y: tMidY },
    { x: tLeft, y: tMidY },
  ];
}

function mapEdge(
  conn: Connection,
  edgeLayout: EdgeLayout | undefined,
  layoutMap: Record<string, NodeLayout>,
  components: Record<string, Component>,
  slot: HandleSlots | undefined,
): ExportEdge {
  const eff = getEffectiveConnectionStyle(conn);
  const anchors = inferAnchors(conn.sourceId, conn.targetId, layoutMap, components, slot);

  // User-authored waypoints (from manual edge editing) take priority.
  // When absent, synthesize boundary-aware waypoints so orthogonal routing
  // does not cut through sibling nodes inside the same container.
  const userWaypoints =
    edgeLayout?.points && edgeLayout.points.length > 0
      ? edgeLayout.points.map((p) => ({ x: p.x, y: p.y }))
      : undefined;

  const waypoints =
    userWaypoints ??
    buildContainerWaypoints(conn.sourceId, conn.targetId, components, layoutMap);

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
    waypoints,
    ...anchors,
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
