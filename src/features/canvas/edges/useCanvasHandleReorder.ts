/**
 * Handler para reordenar handles de conexões (incoming/outgoing).
 */
import { useCallback } from "react";
import { isDiagramCompareMode, useActiveDiagram } from "@/features/diagram";
import { useFlowMode } from "../flow/FlowModeContext";

interface UseCanvasHandleReorderParams {
  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>;
  updateHandleOrder: (nodeId: string, side: "incoming" | "outgoing", order: string[]) => void;
}

export function useCanvasHandleReorder({
  effectiveHandleOrder,
  updateHandleOrder,
}: UseCanvasHandleReorderParams) {
  const diagram = useActiveDiagram();
  const { isRecording, isPlaying } = useFlowMode();
  const onReorderHandle = useCallback(
    (
      nodeId: string,
      side: "incoming" | "outgoing",
      connId: string,
      direction: "up" | "down",
    ) => {
      if (isRecording || isPlaying || (diagram ? isDiagramCompareMode(diagram) : false)) return;

      const currentOrder = effectiveHandleOrder[nodeId]?.[side] ?? [];
      const idx = currentOrder.indexOf(connId);
      if (idx === -1) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= currentOrder.length) return;

      const newOrder = [...currentOrder];
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      updateHandleOrder(nodeId, side, newOrder);
    },
    [diagram, isRecording, isPlaying, effectiveHandleOrder, updateHandleOrder],
  );

  return { onReorderHandle };
}
