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
  buildStepPath,
  buildStepSegments,
  computeCornerDrag,
  computeSegmentDrag,
  defaultOrthogonalCorners,
  pruneRedundantCorners,
  type StepSegment,
} from "../geometry/orthogonal";
import { resolveAxis, useEdgeSnapping, type SnapGuide } from "./snapping";

export type { SnapGuide };

export interface UseSegmentDragResult {
  /** Interior corners actually used for rendering (stored, or the default route). */
  corners: Point[];
  segments: StepSegment[];
  activeSegmentIndex: number | null;
  activeCornerIndex: number | null;
  /** Semi-transparent route shown while a segment/corner is being dragged. */
  previewPath: string | null;
  /** Grid/alignment guides shown while the current drag is snapped. */
  snapGuides: SnapGuide[];
  startSegmentDrag: (segment: StepSegment, event: ReactPointerEvent<SVGLineElement>) => void;
  startCornerDrag: (cornerIndex: number, event: ReactPointerEvent<SVGRectElement>) => void;
  /** Insert a new draggable corner splitting the segment at `segmentIndex`. */
  addCornerAt: (segmentIndex: number, position: Point) => void;
  /** Remove the interior corner at `cornerIndex`. */
  removeCorner: (cornerIndex: number) => void;
  /** Nudge a corner by a keyboard step (grid cell, or 1px when `fine`). */
  nudgeCorner: (cornerIndex: number, dx: number, dy: number) => void;
}

/**
 * draw.io-style orthogonal editing: drag a horizontal/vertical segment
 * perpendicular to reposition it, or drag a corner directly, materializing the
 * affected corners as control points. Drags snap magnetically to node
 * alignment lines and the grid (Alt bypasses), show a live preview, and stream
 * updates without history after a single checkpoint, so one drag is one undo
 * step. Corners can also be nudged with the keyboard.
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
  const { capture } = useEdgeSnapping();
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
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

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

  // Write the in-progress corners to the store, coalescing a gesture into one
  // history step (checkpoint only on the first move).
  const commit = useCallback(
    (diagramId: string, next: Point[], checkpoint: boolean) => {
      const previous = pointsRef.current;
      const cps = next.map((p, index) => ({
        id: previous[index]?.id ?? generateId("cp"),
        x: p.x,
        y: p.y,
      }));
      setEdgeControlPoints(diagramId, connectionId, cps, { history: checkpoint });
    },
    [connectionId, setEdgeControlPoints],
  );

  const detach = useCallback((onMove: (event: PointerEvent) => void, onUp: () => void) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    cleanupRef.current = null;
    document.body.style.cursor = "";
    setActiveSegmentIndex(null);
    setActiveCornerIndex(null);
    setPreviewPath(null);
    setSnapGuides([]);
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
      const perp = horizontal ? (segment.x1 + segment.x2) / 2 : (segment.y1 + segment.y2) / 2;
      const session = capture();
      let checkpointed = false;
      let lastNext: Point[] | null = null;
      setActiveSegmentIndex(segment.index);
      document.body.style.cursor = horizontal ? "ns-resize" : "ew-resize";

      const onMove = (pointerEvent: PointerEvent) => {
        const current = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
        const delta = { x: current.x - startPos.x, y: current.y - startPos.y };
        if (!pointerEvent.altKey) {
          const rawAxis = originAxis + (horizontal ? delta.y : delta.x);
          const snap = resolveAxis(horizontal ? "y" : "x", rawAxis, perp, session, true);
          if (horizontal) delta.y = snap.value - originAxis;
          else delta.x = snap.value - originAxis;
          setSnapGuides(snap.guide ? [snap.guide] : []);
        } else {
          setSnapGuides([]);
        }
        const next = computeSegmentDrag(source, target, initialCorners, segment, delta);
        lastNext = next;
        setPreviewPath(buildStepPath(source, target, next));
        commit(activeDiagramId, next, !checkpointed);
        checkpointed = true;
      };

      const onUp = () => {
        if (lastNext) {
          const pruned = pruneRedundantCorners(source, target, lastNext);
          if (pruned.length !== lastNext.length) commit(activeDiagramId, pruned, false);
        }
        detach(onMove, onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [activeDiagramId, screenToFlowPosition, source, target, commit, detach, capture],
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
      const session = capture();
      let checkpointed = false;
      let lastNext: Point[] | null = null;
      setActiveCornerIndex(cornerIndex);
      document.body.style.cursor = "move";

      const onMove = (pointerEvent: PointerEvent) => {
        const current = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
        const delta = { x: current.x - startPos.x, y: current.y - startPos.y };
        if (!pointerEvent.altKey) {
          const rawX = origin.x + delta.x;
          const rawY = origin.y + delta.y;
          const snapX = resolveAxis("x", rawX, rawY, session, true);
          const snapY = resolveAxis("y", rawY, rawX, session, true);
          delta.x = snapX.value - origin.x;
          delta.y = snapY.value - origin.y;
          setSnapGuides([snapX.guide, snapY.guide].filter((g): g is SnapGuide => g !== null));
        } else {
          setSnapGuides([]);
        }
        const next = computeCornerDrag(source, target, initialCorners, cornerIndex, delta);
        lastNext = next;
        setPreviewPath(buildStepPath(source, target, next));
        commit(activeDiagramId, next, !checkpointed);
        checkpointed = true;
      };

      const onUp = () => {
        if (lastNext) {
          const pruned = pruneRedundantCorners(source, target, lastNext);
          if (pruned.length !== lastNext.length) commit(activeDiagramId, pruned, false);
        }
        detach(onMove, onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [activeDiagramId, screenToFlowPosition, source, target, commit, detach, capture],
  );

  // Insert a new corner splitting a segment, materializing the effective route
  // (default or stored) so the added bend persists. One history entry.
  const addCornerAt = useCallback(
    (segmentIndex: number, position: Point) => {
      if (!activeDiagramId) return;
      const next = cornersRef.current.map((c) => ({ x: c.x, y: c.y }));
      next.splice(segmentIndex, 0, { x: position.x, y: position.y });
      commit(activeDiagramId, next, true);
    },
    [activeDiagramId, commit],
  );

  const removeCorner = useCallback(
    (cornerIndex: number) => {
      if (!activeDiagramId) return;
      const next = cornersRef.current
        .map((c) => ({ x: c.x, y: c.y }))
        .filter((_, index) => index !== cornerIndex);
      commit(activeDiagramId, next, true);
    },
    [activeDiagramId, commit],
  );

  const nudgeCorner = useCallback(
    (cornerIndex: number, dx: number, dy: number) => {
      if (!activeDiagramId) return;
      const next = computeCornerDrag(source, target, cornersRef.current, cornerIndex, {
        x: dx,
        y: dy,
      });
      commit(activeDiagramId, next, true);
    },
    [activeDiagramId, commit, source, target],
  );

  return {
    corners,
    segments,
    activeSegmentIndex,
    activeCornerIndex,
    previewPath,
    snapGuides,
    startSegmentDrag,
    startCornerDrag,
    addCornerAt,
    removeCorner,
    nudgeCorner,
  };
}
