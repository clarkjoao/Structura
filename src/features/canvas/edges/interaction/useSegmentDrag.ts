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
import { GRID_SIZE } from "../../canvas.constants";
import {
  buildStepPath,
  buildStepSegments,
  computeCornerDrag,
  computeSegmentDrag,
  defaultOrthogonalCorners,
  snapToGrid,
  type StepSegment,
} from "../geometry/orthogonal";

/** Snap when the nearest grid line is within half a cell (i.e. always, magnetically). */
const SNAP_THRESHOLD = GRID_SIZE / 2;

/** A grid line to draw while a drag is snapped, in flow coordinates. */
export interface SnapGuide {
  orientation: "horizontal" | "vertical";
  /** Constant axis value (y for horizontal, x for vertical). */
  position: number;
  /** Extent of the guide along the varying axis. */
  from: number;
  to: number;
}

export interface UseSegmentDragResult {
  /** Interior corners actually used for rendering (stored, or the default route). */
  corners: Point[];
  segments: StepSegment[];
  activeSegmentIndex: number | null;
  activeCornerIndex: number | null;
  /** Semi-transparent route shown while a segment/corner is being dragged. */
  previewPath: string | null;
  /** Grid line shown while the current drag is snapped, or `null`. */
  snapGuide: SnapGuide | null;
  startSegmentDrag: (segment: StepSegment, event: ReactPointerEvent<SVGLineElement>) => void;
  startCornerDrag: (cornerIndex: number, event: ReactPointerEvent<SVGRectElement>) => void;
}

/**
 * draw.io-style orthogonal editing: drag a horizontal/vertical segment
 * perpendicular to reposition it, or drag a corner directly, materializing the
 * affected corners as control points. Drags snap to the canvas grid unless Alt
 * is held, show a live preview of the route, and stream updates without history
 * after a single checkpoint on the first move, so one drag is one undo step.
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
  const [activeCornerIndex, setActiveCornerIndex] = useState<number | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [snapGuide, setSnapGuide] = useState<SnapGuide | null>(null);

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

  // Commit the in-progress corners to the store, coalescing the whole gesture
  // into one history step, and refresh the live preview.
  const commit = useCallback(
    (diagramId: string, next: Point[], checkpoint: boolean) => {
      const previous = pointsRef.current;
      const cps = next.map((p, index) => ({
        id: previous[index]?.id ?? generateId("cp"),
        x: p.x,
        y: p.y,
      }));
      setEdgeControlPoints(diagramId, connectionId, cps, { history: checkpoint });
      setPreviewPath(buildStepPath(source, target, next));
    },
    [connectionId, setEdgeControlPoints, source, target],
  );

  const endDrag = useCallback((onMove: (event: PointerEvent) => void, onUp: () => void) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    cleanupRef.current = null;
    document.body.style.cursor = "";
    setActiveSegmentIndex(null);
    setActiveCornerIndex(null);
    setPreviewPath(null);
    setSnapGuide(null);
  }, []);

  const startSegmentDrag = useCallback(
    (segment: StepSegment, event: ReactPointerEvent<SVGLineElement>) => {
      if (!activeDiagramId) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupRef.current?.();

      const initialCorners = cornersRef.current.map((c) => ({ ...c }));
      const startPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const horizontal = segment.orientation === "horizontal";
      const originAxis = horizontal ? segment.y1 : segment.x1;
      let checkpointed = false;
      setActiveSegmentIndex(segment.index);
      document.body.style.cursor = horizontal ? "ns-resize" : "ew-resize";

      const onMove = (pointerEvent: PointerEvent) => {
        const current = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
        const delta = { x: current.x - startPos.x, y: current.y - startPos.y };
        const snapping = !pointerEvent.altKey;
        // Snap the moved axis by adjusting the delta so the segment lands on a grid line.
        if (snapping) {
          const rawAxis = originAxis + (horizontal ? delta.y : delta.x);
          const point = horizontal ? { x: 0, y: rawAxis } : { x: rawAxis, y: 0 };
          const snapped = horizontal
            ? snapToGrid(point, GRID_SIZE, SNAP_THRESHOLD).y
            : snapToGrid(point, GRID_SIZE, SNAP_THRESHOLD).x;
          if (horizontal) delta.y = snapped - originAxis;
          else delta.x = snapped - originAxis;
          setSnapGuide(
            snapped !== rawAxis
              ? buildGuide(source, target, initialCorners, horizontal, snapped)
              : null,
          );
        } else {
          setSnapGuide(null);
        }
        const next = computeSegmentDrag(source, target, initialCorners, segment, delta);
        commit(activeDiagramId, next, !checkpointed);
        checkpointed = true;
      };

      const onUp = () => endDrag(onMove, onUp);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [activeDiagramId, screenToFlowPosition, source, target, commit, endDrag],
  );

  const startCornerDrag = useCallback(
    (cornerIndex: number, event: ReactPointerEvent<SVGRectElement>) => {
      if (!activeDiagramId) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupRef.current?.();

      const initialCorners = cornersRef.current.map((c) => ({ ...c }));
      const origin = initialCorners[cornerIndex];
      if (!origin) return;
      const startPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let checkpointed = false;
      setActiveCornerIndex(cornerIndex);
      document.body.style.cursor = "move";

      const onMove = (pointerEvent: PointerEvent) => {
        const current = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
        const delta = { x: current.x - startPos.x, y: current.y - startPos.y };
        if (!pointerEvent.altKey) {
          const raw = { x: origin.x + delta.x, y: origin.y + delta.y };
          const snapped = snapToGrid(raw, GRID_SIZE, SNAP_THRESHOLD);
          delta.x = snapped.x - origin.x;
          delta.y = snapped.y - origin.y;
        }
        const next = computeCornerDrag(source, target, initialCorners, cornerIndex, delta);
        commit(activeDiagramId, next, !checkpointed);
        checkpointed = true;
      };

      const onUp = () => endDrag(onMove, onUp);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [activeDiagramId, screenToFlowPosition, source, target, commit, endDrag],
  );

  return {
    corners,
    segments,
    activeSegmentIndex,
    activeCornerIndex,
    previewPath,
    snapGuide,
    startSegmentDrag,
    startCornerDrag,
  };
}

/** Guide line spanning the route's extent along the axis the segment moves on. */
function buildGuide(
  source: Point,
  target: Point,
  corners: readonly Point[],
  horizontal: boolean,
  position: number,
): SnapGuide {
  const knots = [source, ...corners, target];
  if (horizontal) {
    const xs = knots.map((k) => k.x);
    return { orientation: "horizontal", position, from: Math.min(...xs), to: Math.max(...xs) };
  }
  const ys = knots.map((k) => k.y);
  return { orientation: "vertical", position, from: Math.min(...ys), to: Math.max(...ys) };
}
