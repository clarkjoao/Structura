import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import {
  useActiveDiagramId,
  useDiagramActions,
  useEdgeLabelOffset,
  useEdgeWaypoints,
  EdgeStyle,
  StrokeStyle,
  type Connection,
  type Point,
} from "@/features/diagram";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { useTranslation } from "react-i18next";
import {
  buildOrthogonalPath,
  buildSegments,
  computeSegmentDrag,
  type Segment,
} from "./edgeBuilding";
import { clampLabelPosition, getLabelPointOnPath } from "./edgeGeometry";
import { useLabelDrag } from "./useLabelDrag";
import type { EdgeData } from "./edgeData.types";

const noopUpdateConnection = (_id: string, _patch: Partial<Omit<Connection, "id">>): void => {};

export function useCustomEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    selected,
    sourcePosition,
    targetPosition,
    markerEnd,
    markerStart,
  } = props;

  const { t } = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
  const activeDiagramId = useActiveDiagramId();
  const { updateEdgeWaypoints, clearEdgeWaypoints, updateEdgeLabelOffset } = useDiagramActions();
  const edgeData = data as unknown as EdgeData;
  const { highlightedConnectionId } = useHandleHighlight();
  const waypoints = useEdgeWaypoints(edgeData?.connectionId ?? "");
  const layoutLabelOffset = useEdgeLabelOffset(edgeData?.connectionId ?? "");
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const waypointsRef = useRef(waypoints);
  const windowPointerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);
  useEffect(
    () => () => {
      windowPointerCleanupRef.current?.();
      windowPointerCleanupRef.current = null;
    },
    [],
  );

  const styleKey = edgeData?.edgeStyle ?? EdgeStyle.Smoothstep;
  const edgePath = useMemo(() => {
    if (waypoints.length > 0) {
      return buildOrthogonalPath(sourceX, sourceY, targetX, targetY, waypoints);
    }
    const pathParams = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    if (styleKey === EdgeStyle.Step) {
      return getSmoothStepPath({ ...pathParams, borderRadius: 0 })[0];
    }
    if (styleKey === EdgeStyle.Smoothstep) return getSmoothStepPath(pathParams)[0];
    if (styleKey === EdgeStyle.Bezier) return getBezierPath(pathParams)[0];
    return getStraightPath(pathParams)[0];
  }, [sourcePosition, sourceX, sourceY, styleKey, targetPosition, targetX, targetY, waypoints]);

  const effectiveLabelOffset = useMemo(() => {
    if (typeof layoutLabelOffset === "number" && !Number.isNaN(layoutLabelOffset)) {
      return clampLabelPosition(layoutLabelOffset);
    }
    return clampLabelPosition(edgeData?.labelPosition);
  }, [edgeData?.labelPosition, layoutLabelOffset]);

  const labelPoint = useMemo(
    () => getLabelPointOnPath(sourceX, sourceY, targetX, targetY, waypoints, effectiveLabelOffset),
    [effectiveLabelOffset, sourceX, sourceY, targetX, targetY, waypoints],
  );

  const commitWaypoints = useCallback(
    (next: Point[]) => {
      if (!activeDiagramId || !edgeData?.connectionId) return;
      waypointsRef.current = next;
      updateEdgeWaypoints(activeDiagramId, edgeData.connectionId, next);
    },
    [activeDiagramId, edgeData?.connectionId, updateEdgeWaypoints],
  );

  const endWindowPointerDrag = useCallback(() => {
    windowPointerCleanupRef.current?.();
    windowPointerCleanupRef.current = null;
    document.body.style.cursor = "";
  }, []);

  const startWindowPointerDrag = useCallback(
    (onMove: (pointerEvent: PointerEvent) => void, dragCursor: string) => {
      endWindowPointerDrag();
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        windowPointerCleanupRef.current = null;
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      windowPointerCleanupRef.current = onUp;
      document.body.style.cursor = dragCursor;
    },
    [endWindowPointerDrag],
  );

  const handleSegmentPointerDown = useCallback(
    (segment: Segment) => {
      return (event: ReactPointerEvent<SVGLineElement>) => {
        if (!activeDiagramId || !edgeData?.connectionId) return;
        event.preventDefault();
        event.stopPropagation();
        const initialWaypoints = waypointsRef.current.map((point) => ({ ...point }));
        const startPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const dragCursor = segment.orientation === "horizontal" ? "ns-resize" : "ew-resize";
        const onMove = (pointerEvent: PointerEvent) => {
          const currentPos = screenToFlowPosition({
            x: pointerEvent.clientX,
            y: pointerEvent.clientY,
          });
          const delta: Point = {
            x: currentPos.x - startPos.x,
            y: currentPos.y - startPos.y,
          };
          commitWaypoints(
            computeSegmentDrag(
              sourceX,
              sourceY,
              targetX,
              targetY,
              initialWaypoints,
              segment,
              delta,
            ),
          );
        };
        startWindowPointerDrag(onMove, dragCursor);
      };
    },
    [
      activeDiagramId,
      commitWaypoints,
      edgeData?.connectionId,
      screenToFlowPosition,
      sourceX,
      sourceY,
      startWindowPointerDrag,
      targetX,
      targetY,
    ],
  );

  const segments = useMemo(
    () => buildSegments(sourceX, sourceY, targetX, targetY, waypoints),
    [sourceX, sourceY, targetX, targetY, waypoints],
  );

  const isHighlighted = selected || highlightedConnectionId === edgeData.connectionId;
  const strokeStyle = edgeData?.strokeStyle ?? StrokeStyle.Solid;
  const strokeWidth = edgeData?.strokeWidth ?? 1;
  const canDragLabelAlongPath = Boolean(
    edgeData?.label && activeDiagramId && edgeData?.connectionId,
  );

  const labelDrag = useLabelDrag({
    edgePath,
    initialPosition: effectiveLabelOffset,
    connectionId: edgeData.connectionId,
    connectionStyle: edgeData.connectionStyle,
    updateConnection: noopUpdateConnection,
    screenToFlowPosition,
    diagramId: activeDiagramId,
    sourceX,
    sourceY,
    targetX,
    targetY,
    waypointsRef,
    updateEdgeLabelOffset,
    enabled: canDragLabelAlongPath,
  });

  const handleEdgeWaypointsDoubleClick = useCallback(
    (event: ReactMouseEvent<SVGPathElement | SVGLineElement>) => {
      if (waypoints.length === 0) return;
      if (!activeDiagramId || !edgeData?.connectionId) return;
      event.preventDefault();
      event.stopPropagation();
      clearEdgeWaypoints(activeDiagramId, edgeData.connectionId);
    },
    [activeDiagramId, clearEdgeWaypoints, edgeData?.connectionId, waypoints.length],
  );

  const handleWaypointDoubleClick = useCallback(
    (index: number) => {
      if (!activeDiagramId || !edgeData?.connectionId) return;
      const next = waypointsRef.current.filter((_, i) => i !== index);
      if (next.length === 0) {
        clearEdgeWaypoints(activeDiagramId, edgeData.connectionId);
      } else {
        updateEdgeWaypoints(activeDiagramId, edgeData.connectionId, next);
      }
    },
    [activeDiagramId, clearEdgeWaypoints, edgeData?.connectionId, updateEdgeWaypoints],
  );

  const showSegmentHitTargets = Boolean(
    activeDiagramId && edgeData?.connectionId && styleKey === EdgeStyle.Step,
  );

  return {
    t,
    id,
    markerEnd,
    markerStart,
    selected,
    edgePath,
    edgeData,
    labelPoint,
    effectiveLabelOffset,
    segments,
    waypoints,
    hoveredSegmentIndex,
    setHoveredSegmentIndex,
    handleSegmentPointerDown,
    handleEdgeWaypointsDoubleClick,
    handleWaypointDoubleClick,
    showSegmentHitTargets,
    isHighlighted,
    strokeWidth,
    strokeStyle,
    canDragLabelAlongPath,
    labelDrag,
  };
}
