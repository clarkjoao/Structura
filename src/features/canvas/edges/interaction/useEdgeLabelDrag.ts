import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import { useActiveDiagramId, useDiagramActions, type Point } from "@/features/diagram";
import { getClosestOffsetOnPath } from "../geometry/projection";

interface UseEdgeLabelDragParams {
  connectionId: string;
  enabled: boolean;
  source: Point;
  target: Point;
  pointsRef: React.RefObject<readonly Point[]>;
}

export interface UseEdgeLabelDragResult {
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * Drag an edge label along its path. Streams the normalized offset to the store
 * without pushing history on every move; the first committed move records one
 * checkpoint so the whole gesture is a single undo step.
 */
export function useEdgeLabelDrag({
  connectionId,
  enabled,
  source,
  target,
  pointsRef,
}: UseEdgeLabelDragParams): UseEdgeLabelDragResult {
  const activeDiagramId = useActiveDiagramId();
  const { screenToFlowPosition } = useReactFlow();
  const { setEdgeLabelOffset } = useDiagramActions();
  const draggingRef = useRef(false);
  const checkpointedRef = useRef(false);
  const lastOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    draggingRef.current = false;
    checkpointedRef.current = false;
  }, [connectionId]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || !activeDiagramId) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      checkpointedRef.current = false;
    },
    [activeDiagramId, enabled],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !activeDiagramId) return;
      const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const raw = getClosestOffsetOnPath(source, target, pointsRef.current ?? [], flowPoint);
      const clamped = Math.max(0.05, Math.min(0.95, raw));
      if (lastOffsetRef.current !== null && Math.abs(clamped - lastOffsetRef.current) < 0.003) {
        return;
      }
      lastOffsetRef.current = clamped;
      setEdgeLabelOffset(activeDiagramId, connectionId, clamped, {
        history: !checkpointedRef.current,
      });
      checkpointedRef.current = true;
    },
    [
      activeDiagramId,
      connectionId,
      screenToFlowPosition,
      setEdgeLabelOffset,
      source,
      target,
      pointsRef,
    ],
  );

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    lastOffsetRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
