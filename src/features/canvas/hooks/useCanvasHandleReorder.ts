/**
 * Handler para reordenar handles de conexões (incoming/outgoing).
 */
import { useCallback } from "react";
import { useRecordingMode } from "../contexts/RecordingModeContext";

interface UseCanvasHandleReorderParams {
  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>;
  updateHandleOrder: (nodeId: string, side: "incoming" | "outgoing", order: string[]) => void;
}

export function useCanvasHandleReorder({
  effectiveHandleOrder,
  updateHandleOrder,
}: UseCanvasHandleReorderParams) {
  const { isRecording } = useRecordingMode();
  const onReorderHandle = useCallback(
    (
      nodeId: string,
      side: "incoming" | "outgoing",
      connId: string,
      direction: "up" | "down",
    ) => {
      if (isRecording) return;

      const currentOrder = effectiveHandleOrder[nodeId]?.[side] ?? [];
      const idx = currentOrder.indexOf(connId);
      if (idx === -1) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= currentOrder.length) return;

      const newOrder = [...currentOrder];
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      updateHandleOrder(nodeId, side, newOrder);
    },
    [isRecording, effectiveHandleOrder, updateHandleOrder],
  );

  return { onReorderHandle };
}
