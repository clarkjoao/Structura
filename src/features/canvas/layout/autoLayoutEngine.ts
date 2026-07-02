import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs";
import ELK from "elkjs/lib/elk.bundled.js";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import {
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
  MAX_HANDLES,
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  isDbTableType,
  isJsonViewerType,
  isNoteComponent,
  isNoteType,
  isPanelComponent,
} from "@/features/diagram";

const ELK_ROOT_ID = "__structura_elk_root__";

const ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.layering.strategy": "LONGEST_PATH",
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.spacing.nodeNode": "40",
  "elk.layered.spacing.edgeNodeBetweenLayers": "40",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "20",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.padding": "[top=40,left=40,bottom=40,right=40]",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "false",
  "elk.layered.wrapping.strategy": "MULTI_EDGE",
  "elk.layered.wrapping.cutting.strategy": "ARD",
  "elk.layered.wrapping.additionalEdgeSpacing": "20",
  "elk.aspectRatio": "2.5",
};

function dimensionsFor(
  component: Component,
  nodeLayouts: Record<string, NodeLayout>,
): { width: number; height: number } {
  const layout = nodeLayouts[component.id];
  const width = layout?.width;
  const height = layout?.height;
  if (width !== undefined && height !== undefined && width > 0 && height > 0) {
    return { width, height };
  }
  if (isPanelComponent(component)) {
    return { width: PANEL_DEFAULT_W, height: PANEL_DEFAULT_H };
  }
  return { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H };
}

function sortedChildIds(
  components: Record<string, Component>,
  parentKey: string | null,
  includedIds: ReadonlySet<string>,
): string[] {
  return Object.values(components)
    .filter((component) => {
      const parentId = component.parentId ?? null;
      return parentId === parentKey && includedIds.has(component.id) && !isNoteComponent(component);
    })
    .map((c) => c.id)
    .sort((a, b) => a.localeCompare(b));
}

/** Direct layout roots plus every descendant reachable under those roots within `panelId`. */
function collectDescendantsUnderPanelRoots(
  components: Record<string, Component>,
  panelId: string,
  layoutRootIds: readonly string[],
): Set<string> {
  const includedIds = new Set<string>();

  const visitSubtree = (componentId: string): void => {
    if (includedIds.has(componentId)) return;
    includedIds.add(componentId);
    for (const component of Object.values(components)) {
      if (component.parentId === componentId) {
        visitSubtree(component.id);
      }
    }
  };

  for (const rootId of layoutRootIds) {
    const root = components[rootId];
    if (root?.parentId === panelId) {
      visitSubtree(rootId);
    }
  }

  return includedIds;
}

function collectIncludedIds(
  components: Record<string, Component>,
  connections: Connection[],
): Set<string> | null {
  const relevantConnections = connections.filter((connection) => {
    const source = components[connection.sourceId];
    const target = components[connection.targetId];
    return (
      source !== undefined &&
      target !== undefined &&
      !isNoteComponent(source) &&
      !isNoteComponent(target)
    );
  });

  if (relevantConnections.length === 0) {
    return null;
  }

  const connectedIds = new Set<string>();
  for (const connection of relevantConnections) {
    connectedIds.add(connection.sourceId);
    connectedIds.add(connection.targetId);
  }

  const includedIds = new Set<string>();
  for (const componentId of connectedIds) {
    includedIds.add(componentId);
    let parentId: string | null | undefined = components[componentId]?.parentId;
    while (parentId) {
      includedIds.add(parentId);
      parentId = components[parentId]?.parentId;
    }
  }

  return includedIds;
}

/** Mirrors `resolveHandleIndex` in `connectionDerivations.ts`. */
function resolveSlot(
  connId: string,
  order: string[] | undefined,
  usageCount: number,
  slotCount: number,
): number {
  if (order?.length) {
    const idx = order.indexOf(connId);
    return idx !== -1 ? Math.min(idx, slotCount - 1) : usageCount % slotCount;
  }
  return usageCount % slotCount;
}

function usesSingleIncomingHandle(component: Component | undefined): boolean {
  if (component === undefined) return false;
  return (
    isNoteType(component.type) || isDbTableType(component.type) || isJsonViewerType(component.type)
  );
}

function isCompoundPanelInLayout(
  componentId: string,
  components: Record<string, Component>,
  includedIds: ReadonlySet<string>,
  compoundCache: Map<string, boolean>,
): boolean {
  const cached = compoundCache.get(componentId);
  if (cached !== undefined) return cached;
  const component = components[componentId];
  const result =
    isPanelComponent(component) && sortedChildIds(components, componentId, includedIds).length > 0;
  compoundCache.set(componentId, result);
  return result;
}

function buildEdgeEndpoints(
  connections: Connection[],
  components: Record<string, Component>,
  includedIds: ReadonlySet<string>,
): Map<string, { sourceEnd: string; targetEnd: string }> {
  const filtered = connections.filter(
    (connection) => includedIds.has(connection.sourceId) && includedIds.has(connection.targetId),
  );
  const sorted = [...filtered].sort((a, b) => a.id.localeCompare(b.id));

  const counts: Record<string, { incoming: number; outgoing: number }> = {};
  for (const connection of sorted) {
    if (!counts[connection.sourceId]) {
      counts[connection.sourceId] = { incoming: 0, outgoing: 0 };
    }
    if (!counts[connection.targetId]) {
      counts[connection.targetId] = { incoming: 0, outgoing: 0 };
    }
    counts[connection.sourceId].outgoing += 1;
    counts[connection.targetId].incoming += 1;
  }

  const compoundCache = new Map<string, boolean>();
  const sourceUsage: Record<string, number> = {};
  const targetUsage: Record<string, number> = {};
  const result = new Map<string, { sourceEnd: string; targetEnd: string }>();

  for (const connection of sorted) {
    const sourceCompound = isCompoundPanelInLayout(
      connection.sourceId,
      components,
      includedIds,
      compoundCache,
    );
    const targetCompound = isCompoundPanelInLayout(
      connection.targetId,
      components,
      includedIds,
      compoundCache,
    );

    const outCount = Math.min(MAX_HANDLES, Math.max(1, counts[connection.sourceId]?.outgoing ?? 1));
    const targetComp = components[connection.targetId];
    const inCount = usesSingleIncomingHandle(targetComp)
      ? 1
      : Math.min(MAX_HANDLES, Math.max(1, counts[connection.targetId]?.incoming ?? 1));

    const srcOrder = components[connection.sourceId]?.handleOrder?.outgoing;
    const tgtOrder = components[connection.targetId]?.handleOrder?.incoming;

    let sourceEnd: string;
    if (sourceCompound) {
      sourceEnd = connection.sourceId;
    } else {
      const sourceSlotIndex = resolveSlot(
        connection.id,
        srcOrder,
        sourceUsage[connection.sourceId] ?? 0,
        outCount,
      );
      sourceUsage[connection.sourceId] = (sourceUsage[connection.sourceId] ?? 0) + 1;
      sourceEnd = `port-src-${connection.sourceId}-${sourceSlotIndex}`;
    }

    let targetEnd: string;
    if (targetCompound) {
      targetEnd = connection.targetId;
    } else {
      const targetSlotIndex = resolveSlot(
        connection.id,
        tgtOrder,
        targetUsage[connection.targetId] ?? 0,
        inCount,
      );
      targetUsage[connection.targetId] = (targetUsage[connection.targetId] ?? 0) + 1;
      targetEnd = `port-tgt-${connection.targetId}-${targetSlotIndex}`;
    }

    result.set(connection.id, { sourceEnd, targetEnd });
  }

  return result;
}

function buildPortsForNode(
  componentId: string,
  nodeWidth: number,
  nodeHeight: number,
  edgeEndpoints: Map<string, { sourceEnd: string; targetEnd: string }>,
): ElkPort[] {
  const sourceSlots = new Set<number>();
  const targetSlots = new Set<number>();

  for (const endpoints of edgeEndpoints.values()) {
    const sourceMatch = /^port-src-(.+)-(\d+)$/.exec(endpoints.sourceEnd);
    if (sourceMatch && sourceMatch[1] === componentId) {
      sourceSlots.add(parseInt(sourceMatch[2], 10));
    }
    const targetMatch = /^port-tgt-(.+)-(\d+)$/.exec(endpoints.targetEnd);
    if (targetMatch && targetMatch[1] === componentId) {
      targetSlots.add(parseInt(targetMatch[2], 10));
    }
  }

  const slotSpan = MAX_HANDLES;
  const ports: ElkPort[] = [];

  for (const slotIdx of Array.from(sourceSlots).sort((a, b) => a - b)) {
    const yFraction = (slotIdx + 0.5) / slotSpan;
    ports.push({
      id: `port-src-${componentId}-${slotIdx}`,
      width: 8,
      height: 8,
      x: Math.max(0, nodeWidth - 8),
      y: nodeHeight * yFraction,
      layoutOptions: {
        "port.side": "EAST",
        "port.index": String(slotIdx),
      },
    });
  }

  for (const slotIdx of Array.from(targetSlots).sort((a, b) => a - b)) {
    const yFraction = (slotIdx + 0.5) / slotSpan;
    ports.push({
      id: `port-tgt-${componentId}-${slotIdx}`,
      width: 8,
      height: 8,
      x: 0,
      y: nodeHeight * yFraction,
      layoutOptions: {
        "port.side": "WEST",
        "port.index": String(slotIdx),
      },
    });
  }

  return ports;
}

function buildSubtree(
  componentId: string,
  components: Record<string, Component>,
  nodeLayouts: Record<string, NodeLayout>,
  includedIds: ReadonlySet<string>,
  edgeEndpoints: Map<string, { sourceEnd: string; targetEnd: string }>,
): ElkNode {
  const component = components[componentId];
  const dims = dimensionsFor(component, nodeLayouts);

  const childIds = isPanelComponent(component)
    ? sortedChildIds(components, componentId, includedIds)
    : [];

  const isCompoundPanel = isPanelComponent(component) && childIds.length > 0;

  const ports = !isCompoundPanel
    ? buildPortsForNode(componentId, dims.width, dims.height, edgeEndpoints)
    : [];

  const node: ElkNode = {
    id: componentId,
    width: dims.width,
    height: dims.height,
    ports: ports.length > 0 ? ports : undefined,
    layoutOptions: {
      ...ELK_OPTIONS,
      ...(ports.length > 0 ? { "elk.portConstraints": "FIXED_ORDER" } : {}),
    },
  };

  if (isCompoundPanel) {
    node.children = childIds.map((childId) =>
      buildSubtree(childId, components, nodeLayouts, includedIds, edgeEndpoints),
    );
  }

  return node;
}

function extractEdgeWaypoints(laidOut: ElkNode): Map<string, Array<{ x: number; y: number }>> {
  const result = new Map<string, Array<{ x: number; y: number }>>();
  const edges = laidOut.edges ?? [];
  for (const edge of edges) {
    const section = edge.sections?.[0];
    if (!section) continue;

    const bendPoints = section.bendPoints;
    if (!bendPoints?.length) continue;

    result.set(
      edge.id,
      bendPoints.map((point) => ({ x: point.x, y: point.y })),
    );
  }

  return result;
}

function flattenElkPositions(
  node: ElkNode,
  components: Record<string, Component>,
  out: Array<{ elementId: string; x: number; y: number }>,
): void {
  if (node.id !== ELK_ROOT_ID && components[node.id]) {
    out.push({
      elementId: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
    });
  }

  const children = node.children;
  if (!children?.length) return;

  for (const child of children) {
    flattenElkPositions(child, components, out);
  }
}

export interface AutoLayoutResult {
  positions: Array<{ elementId: string; x: number; y: number }>;
  edgeWaypoints: Map<string, Array<{ x: number; y: number }>>;
  laidOutConnectionIds: string[];
}

export async function computeAutoLayout(
  components: Record<string, Component>,
  connections: Connection[],
  nodeLayouts: Record<string, NodeLayout>,
): Promise<AutoLayoutResult> {
  const connectionList = connections;

  const includedIds = collectIncludedIds(components, connectionList);
  if (!includedIds?.size) {
    return {
      positions: [],
      edgeWaypoints: new Map(),
      laidOutConnectionIds: [],
    };
  }

  const rootChildIds = sortedChildIds(components, null, includedIds);
  if (rootChildIds.length === 0) {
    return {
      positions: [],
      edgeWaypoints: new Map(),
      laidOutConnectionIds: [],
    };
  }

  const edgeEndpoints = buildEdgeEndpoints(connectionList, components, includedIds);

  const filteredForLayout = connectionList.filter(
    (connection) => includedIds.has(connection.sourceId) && includedIds.has(connection.targetId),
  );

  const elkEdges: ElkExtendedEdge[] = filteredForLayout.map((connection): ElkExtendedEdge => {
    const ends = edgeEndpoints.get(connection.id);
    return {
      id: connection.id,
      sources: ends ? [ends.sourceEnd] : [connection.sourceId],
      targets: ends ? [ends.targetEnd] : [connection.targetId],
    };
  });

  const laidOutConnectionIds = filteredForLayout.map((connection) => connection.id);

  const graph: ElkNode = {
    id: ELK_ROOT_ID,
    layoutOptions: { ...ELK_OPTIONS },
    children: rootChildIds.map((childId) =>
      buildSubtree(childId, components, nodeLayouts, includedIds, edgeEndpoints),
    ),
    edges: elkEdges,
  };

  const elk = new ELK();
  const laidOut = await elk.layout(graph);

  const edgeWaypoints = extractEdgeWaypoints(laidOut);

  const positions: Array<{ elementId: string; x: number; y: number }> = [];
  flattenElkPositions(laidOut, components, positions);

  return { positions, edgeWaypoints, laidOutConnectionIds };
}

export async function computePanelChildLayout(
  panelId: string,
  components: Record<string, Component>,
  connections: Connection[],
  nodeLayouts: Record<string, NodeLayout>,
): Promise<Array<{ elementId: string; x: number; y: number }>> {
  const directChildren = Object.values(components)
    .filter((component) => component.parentId === panelId && !isNoteComponent(component))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (directChildren.length === 0) {
    return [];
  }

  const childrenSet = new Set(directChildren.map((c) => c.id));

  const internalConnections = connections.filter(
    (connection) => childrenSet.has(connection.sourceId) && childrenSet.has(connection.targetId),
  );

  const connectedDirectIds = new Set<string>();
  for (const connection of internalConnections) {
    connectedDirectIds.add(connection.sourceId);
    connectedDirectIds.add(connection.targetId);
  }

  const layoutRootIds = directChildren.map((c) => c.id).filter((id) => connectedDirectIds.has(id));

  if (layoutRootIds.length === 0) {
    return [];
  }

  const includedIds = collectDescendantsUnderPanelRoots(components, panelId, layoutRootIds);

  const edgeEndpoints = buildEdgeEndpoints(internalConnections, components, includedIds);

  const elkEdges: ElkExtendedEdge[] = internalConnections.map((connection): ElkExtendedEdge => {
    const ends = edgeEndpoints.get(connection.id);
    return {
      id: connection.id,
      sources: ends ? [ends.sourceEnd] : [connection.sourceId],
      targets: ends ? [ends.targetEnd] : [connection.targetId],
    };
  });

  const graph: ElkNode = {
    id: ELK_ROOT_ID,
    layoutOptions: { ...ELK_OPTIONS },
    children: layoutRootIds.map((childId) =>
      buildSubtree(childId, components, nodeLayouts, includedIds, edgeEndpoints),
    ),
    edges: elkEdges,
  };

  const elk = new ELK();
  const laidOut = await elk.layout(graph);

  const positions: Array<{ elementId: string; x: number; y: number }> = [];
  flattenElkPositions(laidOut, components, positions);

  return positions;
}
