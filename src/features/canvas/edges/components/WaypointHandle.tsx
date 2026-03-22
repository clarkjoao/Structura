import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReactFlow } from "@xyflow/react";
import type { Point } from "@/features/diagram";

export interface WaypointHandleProps {
  point: Point;
  onDrag: (newPoint: Point) => void;
  onDoubleClick: () => void;
  ariaLabel: string;
  /** Clears other edge pointer gestures (e.g. midpoint insert) before this drag. */
  onPointerGestureStart?: () => void;
}

const DRAG_THRESHOLD_PX = 5;

const WaypointHandle = memo(
  ({ point, onDrag, onDoubleClick, ariaLabel, onPointerGestureStart }: WaypointHandleProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const cleanupRef = useRef<(() => void) | null>(null);
  const suppressDoubleClickUntilRef = useRef(0);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onPointerGestureStart?.();
      cleanupRef.current?.();

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      let exceededThreshold = false;

      const onMove = (moveEvent: PointerEvent) => {
        if (
          !exceededThreshold &&
          (Math.abs(moveEvent.clientX - startClientX) > DRAG_THRESHOLD_PX ||
            Math.abs(moveEvent.clientY - startClientY) > DRAG_THRESHOLD_PX)
        ) {
          exceededThreshold = true;
        }
        onDrag(screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY }));
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        cleanupRef.current = null;
        if (exceededThreshold) {
          suppressDoubleClickUntilRef.current = Date.now() + 400;
        }
      };

      document.body.style.cursor = "grabbing";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
      cleanupRef.current = onUp;
    },
    [onDrag, onPointerGestureStart, screenToFlowPosition],
  );

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<SVGCircleElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() < suppressDoubleClickUntilRef.current) return;
      onDoubleClick();
    },
    [onDoubleClick],
  );

  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={5}
      fill="hsl(var(--background))"
      stroke="hsl(var(--primary))"
      strokeWidth={1.5}
      className="pointer-events-auto"
      style={{ cursor: "grab" }}
      aria-label={ariaLabel}
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    />
  );
});

WaypointHandle.displayName = "WaypointHandle";

export default WaypointHandle;
