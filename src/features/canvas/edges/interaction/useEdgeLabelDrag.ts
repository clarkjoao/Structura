import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Where the label sits while the gesture is live; null when idle. */
  offset: number | null;
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * Drag an edge label along its path. The offset stays in local state and
 * reaches the store once, on release, so one gesture is one store write and one
 * undo step -- each diagram-store `set()` serializes the whole workspace for
 * persist and is diffed for collaboration.
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
  const lastOffsetRef = useRef<number | null>(null);
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    draggingRef.current = false;
    lastOffsetRef.current = null;
    setOffset(null);
  }, [connectionId]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || !activeDiagramId) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      lastOffsetRef.current = null;
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
      setOffset(clamped);
    },
    [activeDiagramId, screenToFlowPosition, source, target, pointsRef],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const dragged = lastOffsetRef.current;
      lastOffsetRef.current = null;
      // One write for the gesture, and the draft is cleared in the same handler
      // so React commits both together and the label does not jump back first.
      if (dragged !== null && activeDiagramId) {
        setEdgeLabelOffset(activeDiagramId, connectionId, dragged, { history: true });
      }
      setOffset(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [activeDiagramId, connectionId, setEdgeLabelOffset],
  );

  return { offset, handlePointerDown, handlePointerMove, handlePointerUp };
}
