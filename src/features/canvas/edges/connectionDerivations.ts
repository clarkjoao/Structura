import type { Component, Connection } from "@/features/diagram";
import {
  isApiGroupComponent,
  isDbTableType,
  isJsonViewerType,
  isNoteType,
  isPanelComponent,
} from "@/features/diagram";
import { MAX_HANDLES } from "../canvas.constants";

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
  /**
   * How many edges use each side. Handles are rendered per side, so a node with
   * two edges leaving right and one leaving left needs two right handles and one
   * left handle — not three of each. Absent until geometry is known, in which
   * case everything sits on the default sides.
   */
  outgoingRight?: number;
  outgoingLeft?: number;
  incomingLeft?: number;
  incomingRight?: number;
}

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Which sides an edge leaves from and arrives at.
 *
 * The canvas used to be fixed at right -> left whatever the geometry, so an edge
 * to a node further left looped all the way around. The flip happens only when
 * the target is *entirely* left of the source: that leaves a dead band as wide
 * as the horizontal overlap, so a one-pixel nudge near the boundary cannot flip
 * the side back and forth. Stateless, so there is nothing to go stale.
 */
export type EdgeSides = "forward" | "mirrored";

export function resolveEdgeSides(
  source: NodeBox | undefined,
  target: NodeBox | undefined,
): EdgeSides {
  if (!source || !target) return "forward";
  return target.x + target.width < source.x ? "mirrored" : "forward";
}

/** Handle id for one end of an edge, given the sides it uses. */
export function handleIdFor(end: "source" | "target", sides: EdgeSides, slot: number): string {
  // The default sides keep their original ids so recorded flow steps, which
  // store a handleId for highlighting, still resolve.
  if (sides === "forward") return `${end}-${slot}`;
  return end === "source" ? `source-l-${slot}` : `target-r-${slot}`;
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
  boxes?: Record<string, NodeBox>,
): Record<string, ConnectionCounts> {
  const counts: Record<string, ConnectionCounts> = {};
  const blank = (): ConnectionCounts => ({
    incoming: 0,
    outgoing: 0,
    outgoingRight: 0,
    outgoingLeft: 0,
    incomingLeft: 0,
    incomingRight: 0,
  });

  for (const conn of connections) {
    if (!counts[conn.sourceId]) counts[conn.sourceId] = blank();
    if (!counts[conn.targetId]) counts[conn.targetId] = blank();
    counts[conn.sourceId].outgoing += 1;
    counts[conn.targetId].incoming += 1;

    const sides = boxes ? resolveEdgeSides(boxes[conn.sourceId], boxes[conn.targetId]) : "forward";
    if (sides === "forward") {
      counts[conn.sourceId].outgoingRight = (counts[conn.sourceId].outgoingRight ?? 0) + 1;
      counts[conn.targetId].incomingLeft = (counts[conn.targetId].incomingLeft ?? 0) + 1;
    } else {
      counts[conn.sourceId].outgoingLeft = (counts[conn.sourceId].outgoingLeft ?? 0) + 1;
      counts[conn.targetId].incomingRight = (counts[conn.targetId].incomingRight ?? 0) + 1;
    }
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
  boxes?: Record<string, NodeBox>,
): HandleAssignment[] {
  // Usage is tracked per node *and side*, since each side has its own handles.
  const usage: Record<string, number> = {};

  return connections.map((conn) => {
    const sides = boxes ? resolveEdgeSides(boxes[conn.sourceId], boxes[conn.targetId]) : "forward";
    const sourceCounts = connectionCountPerNode[conn.sourceId];
    const targetCounts = connectionCountPerNode[conn.targetId];

    const rawOut =
      sides === "forward"
        ? (sourceCounts?.outgoingRight ?? sourceCounts?.outgoing)
        : (sourceCounts?.outgoingLeft ?? sourceCounts?.outgoing);
    const outCount = Math.min(MAX_HANDLES, Math.max(1, rawOut ?? 1));

    const targetComp = components[conn.targetId];
    const usesSingleIncomingHandle =
      targetComp !== undefined &&
      (isNoteType(targetComp.type) ||
        isDbTableType(targetComp.type) ||
        isJsonViewerType(targetComp.type));

    const rawIn =
      sides === "forward"
        ? (targetCounts?.incomingLeft ?? targetCounts?.incoming)
        : (targetCounts?.incomingRight ?? targetCounts?.incoming);
    const inCount = usesSingleIncomingHandle ? 1 : Math.min(MAX_HANDLES, Math.max(1, rawIn ?? 1));

    const srcOrder = components[conn.sourceId]?.handleOrder?.outgoing;
    const tgtOrder = components[conn.targetId]?.handleOrder?.incoming;

    const sourceKey = `${conn.sourceId}|source|${sides}`;
    const targetKey = `${conn.targetId}|target|${sides}`;

    const sIdx = resolveHandleIndex(conn.id, srcOrder, usage[sourceKey] ?? 0, outCount);
    const tIdx = resolveHandleIndex(conn.id, tgtOrder, usage[targetKey] ?? 0, inCount);

    usage[sourceKey] = (usage[sourceKey] ?? 0) + 1;
    usage[targetKey] = (usage[targetKey] ?? 0) + 1;

    return {
      connId: conn.id,
      sourceHandle: handleIdFor("source", sides, sIdx),
      targetHandle: usesSingleIncomingHandle
        ? singleIncomingTargetHandleId(conn.targetId)
        : handleIdFor("target", sides, tIdx),
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

    const sourceSlot = /^source-(?:l-)?(\d+)$/.exec(a.sourceHandle);
    const targetSlot = /^target-(?:r-)?(\d+)$/.exec(a.targetHandle);
    const sIdx = sourceSlot ? parseInt(sourceSlot[1], 10) : 0;
    const tIdx = targetSlot ? parseInt(targetSlot[1], 10) : 0;

    if (!result[conn.sourceId]) result[conn.sourceId] = { incoming: [], outgoing: [] };
    if (!result[conn.targetId]) result[conn.targetId] = { incoming: [], outgoing: [] };

    result[conn.sourceId].outgoing[sIdx] = conn.id;
    result[conn.targetId].incoming[tIdx] = conn.id;
  }
  return result;
}
