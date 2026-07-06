import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow, type Position } from "@xyflow/react";
import {
  useActiveDiagramId,
  useDiagramActions,
  useEdgeControlPoints,
  generateId,
  type Point,
} from "@/features/diagram";
import {
  buildStepSegments,
  computeSegmentDrag,
  defaultOrthogonalCorners,
  type StepSegment,
} from "../geometry/orthogonal";

export interface UseSegmentDragResult {
  /** Interior corners actually used for rendering (stored, or the default route). */
  corners: Point[];
  segments: StepSegment[];
  activeSegmentIndex: number | null;
  startSegmentDrag: (segment: StepSegment, event: ReactPointerEvent<SVGLineElement>) => void;
}

/**
 * draw.io-style orthogonal segment editing: drag a horizontal/vertical segment
 * perpendicular to reposition it, materializing the affected corners as control
 * points. Streams updates without history after a single checkpoint on the first
 * move, so one drag is one undo step.
 */
export function useSegmentDrag(
  connectionId: string,
  source: Point,
  target: Point,
  sourcePosition: Position | undefined,
): UseSegmentDragResult {
  const activeDiagramId = useActiveDiagramId();
  const { screenToFlowPosition } = useReactFlow();
  const { setEdgeControlPoints } = useDiagramActions();
  const points = useEdgeControlPoints(connectionId);

  const corners = useMemo<Point[]>(
    () =>
      points.length > 0
        ? points.map((p) => ({ x: p.x, y: p.y }))
        : defaultOrthogonalCorners(source, target, sourcePosition),
    [points, source, target, sourcePosition],
  );
  const segments = useMemo(
    () => buildStepSegments(source, target, corners),
    [source, target, corners],
  );

  const cornersRef = useRef(corners);
  const pointsRef = useRef(points);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);

  useEffect(() => {
    cornersRef.current = corners;
    pointsRef.current = points;
  }, [corners, points]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  const startSegmentDrag = useCallback(
    (segment: StepSegment, event: ReactPointerEvent<SVGLineElement>) => {
      if (!activeDiagramId) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupRef.current?.();

      const initialCorners = cornersRef.current.map((c) => ({ ...c }));
      const startPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let checkpointed = false;
      setActiveSegmentIndex(segment.index);
      document.body.style.cursor = segment.orientation === "horizontal" ? "ns-resize" : "ew-resize";

      const onMove = (pointerEvent: PointerEvent) => {
        const current = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
        const delta = { x: current.x - startPos.x, y: current.y - startPos.y };
        const next = computeSegmentDrag(source, target, initialCorners, segment, delta);
        const previous = pointsRef.current;
        const cps = next.map((p, index) => ({
          id: previous[index]?.id ?? generateId("cp"),
          x: p.x,
          y: p.y,
        }));
        setEdgeControlPoints(activeDiagramId, connectionId, cps, { history: !checkpointed });
        checkpointed = true;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        cleanupRef.current = null;
        document.body.style.cursor = "";
        setActiveSegmentIndex(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [activeDiagramId, connectionId, screenToFlowPosition, setEdgeControlPoints, source, target],
  );

  return { corners, segments, activeSegmentIndex, startSegmentDrag };
}
