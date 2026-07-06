import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  useActiveDiagramId,
  useDiagramActions,
  useEdgeControlPoints,
  generateId,
  type EdgeControlPoint,
} from "@/features/diagram";

export interface UseControlPointsResult {
  points: EdgeControlPoint[];
  /** Id of the point currently being dragged, for visual emphasis. */
  activePointId: string | null;
  addPoint: (insertIndex: number, position: { x: number; y: number }) => void;
  removePoint: (pointId: string) => void;
  startPointDrag: (pointId: string, event: ReactPointerEvent<SVGCircleElement>) => void;
}

/**
 * Bridges control-point pointer gestures to the diagram store. A drag streams
 * position updates without pushing history and lets the store record a single
 * checkpoint on the first move, so one drag collapses to one undo step. Add and
 * remove are discrete, each their own history entry.
 */
export function useControlPoints(connectionId: string): UseControlPointsResult {
  const activeDiagramId = useActiveDiagramId();
  const { screenToFlowPosition } = useReactFlow();
  const { setEdgeControlPoints, addEdgeControlPoint, removeEdgeControlPoint } = useDiagramActions();
  const points = useEdgeControlPoints(connectionId);
  const pointsRef = useRef(points);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [activePointId, setActivePointId] = useState<string | null>(null);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  const addPoint = useCallback(
    (insertIndex: number, position: { x: number; y: number }) => {
      if (!activeDiagramId) return;
      addEdgeControlPoint(
        activeDiagramId,
        connectionId,
        { id: generateId("cp"), x: position.x, y: position.y },
        insertIndex,
      );
    },
    [activeDiagramId, addEdgeControlPoint, connectionId],
  );

  const removePoint = useCallback(
    (pointId: string) => {
      if (!activeDiagramId) return;
      removeEdgeControlPoint(activeDiagramId, connectionId, pointId);
    },
    [activeDiagramId, connectionId, removeEdgeControlPoint],
  );

  const startPointDrag = useCallback(
    (pointId: string, event: ReactPointerEvent<SVGCircleElement>) => {
      if (!activeDiagramId) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupRef.current?.();

      let checkpointed = false;
      setActivePointId(pointId);
      document.body.style.cursor = "grabbing";

      const onMove = (pointerEvent: PointerEvent) => {
        const position = screenToFlowPosition({
          x: pointerEvent.clientX,
          y: pointerEvent.clientY,
        });
        const next = pointsRef.current.map((point) =>
          point.id === pointId ? { ...point, x: position.x, y: position.y } : point,
        );
        setEdgeControlPoints(activeDiagramId, connectionId, next, { history: !checkpointed });
        checkpointed = true;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        cleanupRef.current = null;
        document.body.style.cursor = "";
        setActivePointId(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [activeDiagramId, connectionId, screenToFlowPosition, setEdgeControlPoints],
  );

  return { points, activePointId, addPoint, removePoint, startPointDrag };
}
