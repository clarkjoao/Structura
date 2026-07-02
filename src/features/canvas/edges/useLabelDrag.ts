import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Connection, ConnectionStyle, Point } from "@/features/diagram";
import { getClosestLabelPositionOnPath } from "./edgeGeometry";

export interface UseLabelDragParams {
  edgePath: string;
  initialPosition: number;
  connectionId: string;
  connectionStyle?: ConnectionStyle;
  updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  diagramId: string | null;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  waypointsRef: RefObject<Point[]>;
  updateEdgeLabelOffset: (diagramId: string, connectionId: string, offset: number) => void;
  enabled: boolean;
}

export interface UseLabelDragResult {
  dragPathRef: RefObject<SVGPathElement>;
  lastSentPositionRef: RefObject<number>;
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function useLabelDrag(params: UseLabelDragParams): UseLabelDragResult {
  const {
    edgePath,
    initialPosition,
    connectionId,
    connectionStyle,
    updateConnection,
    screenToFlowPosition,
    diagramId,
    sourceX,
    sourceY,
    targetX,
    targetY,
    waypointsRef,
    updateEdgeLabelOffset,
    enabled,
  } = params;

  void edgePath;
  void updateConnection;
  void connectionStyle;

  const dragPathRef = useRef<SVGPathElement>(null);
  const lastSentPositionRef = useRef<number>(initialPosition);
  const draggingRef = useRef(false);

  useEffect(() => {
    lastSentPositionRef.current = initialPosition;
  }, [initialPosition]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || !diagramId) return;
      event.preventDefault();
      event.stopPropagation();
      lastSentPositionRef.current = initialPosition;
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
    },
    [diagramId, enabled, initialPosition],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !diagramId) return;
      const flowPoint = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const waypoints = waypointsRef.current ?? [];
      const raw = getClosestLabelPositionOnPath(
        sourceX,
        sourceY,
        targetX,
        targetY,
        waypoints,
        flowPoint,
      );
      const clamped = Math.max(0.05, Math.min(0.95, raw));
      if (Math.abs(clamped - lastSentPositionRef.current) < 0.003) return;
      lastSentPositionRef.current = clamped;
      updateEdgeLabelOffset(diagramId, connectionId, clamped);
    },
    [
      connectionId,
      diagramId,
      screenToFlowPosition,
      sourceX,
      sourceY,
      targetX,
      targetY,
      updateEdgeLabelOffset,
      waypointsRef,
    ],
  );

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return {
    dragPathRef,
    lastSentPositionRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
