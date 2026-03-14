/**
 * Aplica overlay de drag e pulse aos nodes antes de renderizar no ReactFlow.
 * Encapsula a lógica de dragPositions e pulseNodeId.
 */
import { useCallback, useMemo } from "react";
import type { Node, OnNodesChange } from "@xyflow/react";

interface UseCanvasRenderNodesParams {
  nodes: Node[];
  dragPositions: Record<string, { x: number; y: number }>;
  pulseNodeId: string | null;
  setDragPositions: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  innerOnNodesChange: OnNodesChange;
  innerOnNodeDragStop: (_: unknown, node: Node) => void;
}

export function useCanvasRenderNodes({
  nodes,
  dragPositions,
  pulseNodeId,
  setDragPositions,
  innerOnNodesChange,
  innerOnNodeDragStop,
}: UseCanvasRenderNodesParams) {
  const renderNodes = useMemo(() => {
    if (Object.keys(dragPositions).length === 0 && !pulseNodeId) return nodes;
    return nodes.map((n) => {
      const dp = dragPositions[n.id];
      const isPulsing = n.id === pulseNodeId;
      if (!dp && !isPulsing) return n;
      return {
        ...n,
        ...(dp ? { position: dp } : {}),
        ...(isPulsing
          ? { className: [n.className, "node-pulse"].filter(Boolean).join(" ") }
          : {}),
      };
    });
  }, [nodes, dragPositions, pulseNodeId]);

  const onNodesChange = useCallback(
    (changes: Parameters<OnNodesChange>[0]) => {
      const overrides: Record<string, { x: number; y: number }> = {};
      let hasDragEnd = false;

      for (const c of changes) {
        if (c.type === "position" && c.position) {
          if (c.dragging) overrides[c.id] = c.position;
          else hasDragEnd = true;
        }
      }

      if (Object.keys(overrides).length > 0) {
        setDragPositions((prev) => ({ ...prev, ...overrides }));
      }
      if (hasDragEnd) setDragPositions({});
      innerOnNodesChange(changes);
    },
    [innerOnNodesChange, setDragPositions],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setDragPositions({});
      innerOnNodeDragStop(_, draggedNode);
    },
    [innerOnNodeDragStop, setDragPositions],
  );

  return { renderNodes, onNodesChange, onNodeDragStop };
}
