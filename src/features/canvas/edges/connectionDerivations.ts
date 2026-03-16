import type { Component, Connection, Diagram } from "@/features/diagram";
import { isPanelComponent } from "@/features/diagram";
import { MAX_HANDLES } from "../constants";

export interface HandleAssignment {
  connId: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface ConnectionCounts {
  incoming: number;
  outgoing: number;
}

export function buildPanelIds(components: Component[]): Set<string> {
  const ids = new Set<string>();
  for (const c of components) {
    if (isPanelComponent(c)) ids.add(c.id);
  }
  return ids;
}

export function buildConnectionCountPerNode(
  connections: Connection[],
): Record<string, ConnectionCounts> {
  const counts: Record<string, ConnectionCounts> = {};
  for (const conn of connections) {
    if (!counts[conn.sourceId]) counts[conn.sourceId] = { incoming: 0, outgoing: 0 };
    if (!counts[conn.targetId]) counts[conn.targetId] = { incoming: 0, outgoing: 0 };
    counts[conn.sourceId].outgoing += 1;
    counts[conn.targetId].incoming += 1;
  }
  return counts;
}

export function resolveHandleIndex(
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

export function buildEdgeHandleAssignments(
  connections: Connection[],
  connectionCountPerNode: Record<string, ConnectionCounts>,
  diagram: Diagram | null | undefined,
): HandleAssignment[] {
  const sourceUsage: Record<string, number> = {};
  const targetUsage: Record<string, number> = {};
  const components = diagram?.snapshot.components ?? {};

  return connections.map((conn) => {
    const outCount = Math.min(
      MAX_HANDLES,
      Math.max(1, connectionCountPerNode[conn.sourceId]?.outgoing ?? 1),
    );
    const inCount = Math.min(
      MAX_HANDLES,
      Math.max(1, connectionCountPerNode[conn.targetId]?.incoming ?? 1),
    );

    const srcOrder = components[conn.sourceId]?.handleOrder?.outgoing;
    const tgtOrder = components[conn.targetId]?.handleOrder?.incoming;

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

    return {
      connId: conn.id,
      sourceHandle: `source-${sIdx}`,
      targetHandle: `target-${tIdx}`,
    };
  });
}

export function buildEffectiveHandleOrder(
  assignments: HandleAssignment[],
  connections: Connection[],
): Record<string, { incoming: string[]; outgoing: string[] }> {
  const result: Record<string, { incoming: string[]; outgoing: string[] }> = {};
  const connMap = new Map(connections.map((c) => [c.id, c]));

  for (const a of assignments) {
    const conn = connMap.get(a.connId);
    if (!conn) continue;

    const sIdx = parseInt(a.sourceHandle.split("-")[1], 10);
    const tIdx = parseInt(a.targetHandle.split("-")[1], 10);

    if (!result[conn.sourceId]) result[conn.sourceId] = { incoming: [], outgoing: [] };
    if (!result[conn.targetId]) result[conn.targetId] = { incoming: [], outgoing: [] };

    result[conn.sourceId].outgoing[sIdx] = conn.id;
    result[conn.targetId].incoming[tIdx] = conn.id;
  }
  return result;
}
