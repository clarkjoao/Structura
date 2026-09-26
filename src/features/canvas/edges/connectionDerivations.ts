import type { Component, Connection } from "@/features/diagram";
import { handleSpecForType } from "../nodes/node-types/registry";
import {
  BOTTOM_SOURCE_HANDLE_ID,
  singleIncomingTargetHandleId,
  slotCountFor,
  SPREAD_HANDLES,
  TOP_TARGET_HANDLE_ID,
} from "../nodes/node-types/handle-spec";

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
 *
 * The one extension is on the flowchart shapes (`verticalSides`): an edge may
 * also leave from the bottom or arrive on the top. That is still the edge's
 * choice, stored on the connection when the user drew it from or to those
 * handles — top is input, bottom is output, and nothing here looks at geometry.
 */

export { singleIncomingTargetHandleId };

export interface HandleAssignment {
  connId: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface ConnectionCounts {
  incoming: number;
  outgoing: number;
}

// Lives with the rest of what the canvas shows, in the pure view module; kept
// exported here for the editor's existing imports.
export { buildPanelIds } from "../core/resolveViewSnapshot";

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
    // The slot has to name a handle the node will render, so the cap comes from
    // what the type declares rather than from `MAX_HANDLES` for everybody. A
    // component missing from the map is a dangling endpoint, not a new type, so
    // it keeps the general spec.
    const sourceComp = components[conn.sourceId];
    const targetComp = components[conn.targetId];
    const sourceSpec = sourceComp ? handleSpecForType(sourceComp.type) : SPREAD_HANDLES;
    const targetSpec = targetComp ? handleSpecForType(targetComp.type) : SPREAD_HANDLES;

    const outCount = slotCountFor(
      sourceSpec.outgoing,
      connectionCountPerNode[conn.sourceId]?.outgoing ?? 1,
    );

    const usesSingleIncomingHandle = targetSpec.incoming === "shared";
    const inCount = slotCountFor(
      targetSpec.incoming,
      connectionCountPerNode[conn.targetId]?.incoming ?? 1,
    );

    const srcOrder = components[conn.sourceId]?.handleOrder?.outgoing;
    const tgtOrder = components[conn.targetId]?.handleOrder?.incoming;

    const sIdx = resolveHandleIndex(conn.id, srcOrder, sourceUsage[conn.sourceId] ?? 0, outCount);
    const tIdx = resolveHandleIndex(conn.id, tgtOrder, targetUsage[conn.targetId] ?? 0, inCount);

    sourceUsage[conn.sourceId] = (sourceUsage[conn.sourceId] ?? 0) + 1;
    targetUsage[conn.targetId] = (targetUsage[conn.targetId] ?? 0) + 1;

    // Sides are fixed: out of the right, into the left. Only the slot varies —
    // unless the edge itself asked for a vertical side the node renders.
    const leavesBottom = conn.sourceSide === "bottom" && sourceSpec.verticalSides === true;
    const entersTop = conn.targetSide === "top" && targetSpec.verticalSides === true;
    return {
      connId: conn.id,
      sourceHandle: leavesBottom ? BOTTOM_SOURCE_HANDLE_ID : `source-${sIdx}`,
      targetHandle: entersTop
        ? TOP_TARGET_HANDLE_ID
        : usesSingleIncomingHandle
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

    // A vertical side is not one of the ordered slots down the left or right.
    if (a.sourceHandle !== BOTTOM_SOURCE_HANDLE_ID) result[conn.sourceId].outgoing[sIdx] = conn.id;
    if (a.targetHandle !== TOP_TARGET_HANDLE_ID) result[conn.targetId].incoming[tIdx] = conn.id;
  }
  return result;
}
