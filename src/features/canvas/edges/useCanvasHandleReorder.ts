import { useCallback, useRef } from "react";
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

  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const effectiveHandleOrderRef = useRef(effectiveHandleOrder);
  effectiveHandleOrderRef.current = effectiveHandleOrder;

  const onReorderHandle = useCallback(
    (nodeId: string, side: "incoming" | "outgoing", connId: string, direction: "up" | "down") => {
      if (
        isRecording ||
        isPlaying ||
        (diagramRef.current ? isDiagramCompareMode(diagramRef.current) : false)
      ) {
        return;
      }

      const currentOrder = effectiveHandleOrderRef.current[nodeId]?.[side] ?? [];
      const idx = currentOrder.indexOf(connId);
      if (idx === -1) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= currentOrder.length) return;

      const newOrder = [...currentOrder];
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      updateHandleOrder(nodeId, side, newOrder);
    },
    [isRecording, isPlaying, updateHandleOrder],
  );

  return { onReorderHandle };
}
