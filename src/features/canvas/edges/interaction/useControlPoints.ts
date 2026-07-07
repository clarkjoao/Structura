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
import { resolveAxis, useEdgeSnapping, type SnapGuide } from "./snapping";

export interface UseControlPointsResult {
  points: EdgeControlPoint[];
  /** Id of the point currently being dragged, for visual emphasis. */
  activePointId: string | null;
  /** Alignment guides shown while a control point is snapped during a drag. */
  snapGuides: SnapGuide[];
  addPoint: (insertIndex: number, position: { x: number; y: number }) => void;
  removePoint: (pointId: string) => void;
  startPointDrag: (pointId: string, event: ReactPointerEvent<SVGCircleElement>) => void;
  /** Nudge a control point by a keyboard step. */
  nudgePoint: (pointId: string, dx: number, dy: number) => void;
}

/**
 * Bridges control-point pointer gestures to the diagram store. A drag streams
 * position updates without pushing history and lets the store record a single
 * checkpoint on the first move, so one drag collapses to one undo step. Points
 * snap magnetically to node alignment lines (Alt bypasses) but stay free-form
 * otherwise. Add, remove, and keyboard nudge are discrete history entries.
 */
export function useControlPoints(connectionId: string): UseControlPointsResult {
  const activeDiagramId = useActiveDiagramId();
  const { screenToFlowPosition } = useReactFlow();
  const { setEdgeControlPoints, addEdgeControlPoint, removeEdgeControlPoint } = useDiagramActions();
  const { capture } = useEdgeSnapping();
  const points = useEdgeControlPoints(connectionId);
  const pointsRef = useRef(points);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

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

  const nudgePoint = useCallback(
    (pointId: string, dx: number, dy: number) => {
      if (!activeDiagramId) return;
      const next = pointsRef.current.map((point) =>
        point.id === pointId ? { ...point, x: point.x + dx, y: point.y + dy } : point,
      );
      setEdgeControlPoints(activeDiagramId, connectionId, next, { history: true });
    },
    [activeDiagramId, connectionId, setEdgeControlPoints],
  );

  const startPointDrag = useCallback(
    (pointId: string, event: ReactPointerEvent<SVGCircleElement>) => {
      if (!activeDiagramId) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupRef.current?.();

      const session = capture();
      let checkpointed = false;
      setActivePointId(pointId);
      document.body.style.cursor = "grabbing";

      const onMove = (pointerEvent: PointerEvent) => {
        const position = screenToFlowPosition({
          x: pointerEvent.clientX,
          y: pointerEvent.clientY,
        });
        let { x, y } = position;
        if (!pointerEvent.altKey) {
          const snapX = resolveAxis("x", x, y, session, false);
          const snapY = resolveAxis("y", y, x, session, false);
          x = snapX.value;
          y = snapY.value;
          setSnapGuides([snapX.guide, snapY.guide].filter((g): g is SnapGuide => g !== null));
        } else {
          setSnapGuides([]);
        }
        const next = pointsRef.current.map((point) =>
          point.id === pointId ? { ...point, x, y } : point,
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
        setSnapGuides([]);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [activeDiagramId, connectionId, screenToFlowPosition, setEdgeControlPoints, capture],
  );

  return {
    points,
    activePointId,
    snapGuides,
    addPoint,
    removePoint,
    startPointDrag,
    nudgePoint,
  };
}
