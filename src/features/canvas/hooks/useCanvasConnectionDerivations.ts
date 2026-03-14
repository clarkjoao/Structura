/**
 * Derivados de connections: panelIds, contagem por nó, handle assignments.
 * Tudo que é computado a partir de visibleComponents + visibleConnections.
 */
import { useMemo } from "react";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { isPanelComponent } from "@/features/diagram";

interface Params {
  visibleComponents: Component[];
  visibleConnections: Connection[];
  diagram: Diagram | null | undefined;
}

export function useCanvasConnectionDerivations({
  visibleComponents,
  visibleConnections,
  diagram,
}: Params) {
  const panelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of visibleComponents) if (isPanelComponent(c)) ids.add(c.id);
    return ids;
  }, [visibleComponents]);

  const connectionCountPerNode = useMemo(() => {
    const counts: Record<string, { incoming: number; outgoing: number }> = {};
    visibleConnections.forEach((conn) => {
      if (!counts[conn.sourceId])
        counts[conn.sourceId] = { incoming: 0, outgoing: 0 };
      if (!counts[conn.targetId])
        counts[conn.targetId] = { incoming: 0, outgoing: 0 };
      counts[conn.sourceId].outgoing += 1;
      counts[conn.targetId].incoming += 1;
    });
    return counts;
  }, [visibleConnections]);

  const edgeHandleAssignments = useMemo(() => {
    const sourceUsage: Record<string, number> = {};
    const targetUsage: Record<string, number> = {};
    const maxHandles = 4;
    return visibleConnections.map((conn) => {
      const outCount = Math.min(
        maxHandles,
        Math.max(1, connectionCountPerNode[conn.sourceId]?.outgoing ?? 1),
      );
      const inCount = Math.min(
        maxHandles,
        Math.max(1, connectionCountPerNode[conn.targetId]?.incoming ?? 1),
      );
      const srcOrder = diagram?.snapshot.components[conn.sourceId]?.handleOrder?.outgoing;
      const tgtOrder = diagram?.snapshot.components[conn.targetId]?.handleOrder?.incoming;
      let sIdx: number;
      if (srcOrder && srcOrder.length > 0) {
        const orderIdx = srcOrder.indexOf(conn.id);
        sIdx = orderIdx !== -1 ? Math.min(orderIdx, outCount - 1) : (sourceUsage[conn.sourceId] ?? 0) % outCount;
      } else {
        sIdx = (sourceUsage[conn.sourceId] ?? 0) % outCount;
      }
      let tIdx: number;
      if (tgtOrder && tgtOrder.length > 0) {
        const orderIdx = tgtOrder.indexOf(conn.id);
        tIdx = orderIdx !== -1 ? Math.min(orderIdx, inCount - 1) : (targetUsage[conn.targetId] ?? 0) % inCount;
      } else {
        tIdx = (targetUsage[conn.targetId] ?? 0) % inCount;
      }
      sourceUsage[conn.sourceId] = (sourceUsage[conn.sourceId] ?? 0) + 1;
      targetUsage[conn.targetId] = (targetUsage[conn.targetId] ?? 0) + 1;
      return {
        connId: conn.id,
        sourceHandle: `source-${sIdx}`,
        targetHandle: `target-${tIdx}`,
      };
    });
  }, [visibleConnections, connectionCountPerNode, diagram]);

  const effectiveHandleOrder = useMemo(() => {
    const result: Record<string, { incoming: string[]; outgoing: string[] }> = {};
    for (const a of edgeHandleAssignments) {
      const conn = visibleConnections.find((c) => c.id === a.connId);
      if (!conn) continue;
      const sIdx = parseInt(a.sourceHandle.split("-")[1]);
      const tIdx = parseInt(a.targetHandle.split("-")[1]);
      if (!result[conn.sourceId]) result[conn.sourceId] = { incoming: [], outgoing: [] };
      if (!result[conn.targetId]) result[conn.targetId] = { incoming: [], outgoing: [] };
      result[conn.sourceId].outgoing[sIdx] = conn.id;
      result[conn.targetId].incoming[tIdx] = conn.id;
    }
    return result;
  }, [edgeHandleAssignments, visibleConnections]);

  return {
    panelIds,
    connectionCountPerNode,
    edgeHandleAssignments,
    effectiveHandleOrder,
  };
}
