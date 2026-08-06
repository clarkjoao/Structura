import type { Component, Connection } from "@/features/diagram";
import {
  isApiGroupComponent,
  isDbTableType,
  isJsonViewerType,
  isNoteType,
  isPanelComponent,
} from "@/features/diagram";
import { MAX_HANDLES } from "../canvas.constants";

/**
 * Handle sides are fixed, by design.
 *
 * Structura diagrams are read left to right, and the handles are what enforce
 * that reading: **left is input only, right is output only**, on every node,
 * whatever its position. An edge leaves its source on the right and arrives at
 * its target on the left — always. Only the slot within a side varies.
 *
 * Do not derive the side from the node positions. The edge states the direction;
 * position only complements it. Deriving the side means dragging a node silently
 * rewires which handles an existing edge uses, so the picture rearranges itself
 * under the user, and a deliberate back-edge — a loop, a retry, a write-back to
 * a store drawn further left — stops reading as one. Same contract as draw.io:
 * the connection owns its endpoints.
 */

export function singleIncomingTargetHandleId(nodeId: string): string {
  return `in-${nodeId}`;
}

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
    if (isPanelComponent(c) || isApiGroupComponent(c)) ids.add(c.id);
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
  components: Record<string, Component>,
): HandleAssignment[] {
  const sourceUsage: Record<string, number> = {};
  const targetUsage: Record<string, number> = {};

  return connections.map((conn) => {
    const outCount = Math.min(
      MAX_HANDLES,
      Math.max(1, connectionCountPerNode[conn.sourceId]?.outgoing ?? 1),
    );
    const targetComp = components[conn.targetId];

    const usesSingleIncomingHandle =
      targetComp !== undefined &&
      (isNoteType(targetComp.type) ||
        isDbTableType(targetComp.type) ||
        isJsonViewerType(targetComp.type));
    const inCount = usesSingleIncomingHandle
      ? 1
      : Math.min(MAX_HANDLES, Math.max(1, connectionCountPerNode[conn.targetId]?.incoming ?? 1));

    const srcOrder = components[conn.sourceId]?.handleOrder?.outgoing;
    const tgtOrder = components[conn.targetId]?.handleOrder?.incoming;

    const sIdx = resolveHandleIndex(conn.id, srcOrder, sourceUsage[conn.sourceId] ?? 0, outCount);
    const tIdx = resolveHandleIndex(conn.id, tgtOrder, targetUsage[conn.targetId] ?? 0, inCount);

    sourceUsage[conn.sourceId] = (sourceUsage[conn.sourceId] ?? 0) + 1;
    targetUsage[conn.targetId] = (targetUsage[conn.targetId] ?? 0) + 1;

    // Sides are fixed: out of the right, into the left. Only the slot varies.
    return {
      connId: conn.id,
      sourceHandle: `source-${sIdx}`,
      targetHandle: usesSingleIncomingHandle
        ? singleIncomingTargetHandleId(conn.targetId)
        : `target-${tIdx}`,
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

    const sourceSlot = /^source-(\d+)$/.exec(a.sourceHandle);
    const targetSlot = /^target-(\d+)$/.exec(a.targetHandle);
    const sIdx = sourceSlot ? parseInt(sourceSlot[1], 10) : 0;
    const tIdx = targetSlot ? parseInt(targetSlot[1], 10) : 0;

    if (!result[conn.sourceId]) result[conn.sourceId] = { incoming: [], outgoing: [] };
    if (!result[conn.targetId]) result[conn.targetId] = { incoming: [], outgoing: [] };

    result[conn.sourceId].outgoing[sIdx] = conn.id;
    result[conn.targetId].incoming[tIdx] = conn.id;
  }
  return result;
}
