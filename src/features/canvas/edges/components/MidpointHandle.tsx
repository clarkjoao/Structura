import { memo, type PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "@/features/diagram";

export interface MidpointHandleProps {
  point: Point;
  onPointerDown: (event: ReactPointerEvent<SVGCircleElement>) => void;
  ariaLabel: string;
}

const MidpointHandle = memo(({ point, onPointerDown, ariaLabel }: MidpointHandleProps) => {
  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={3}
      fill="hsl(var(--primary))"
      opacity={0.35}
      className="pointer-events-auto"
      style={{ cursor: "grab" }}
      aria-label={ariaLabel}
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
    />
  );
});

MidpointHandle.displayName = "MidpointHandle";

export default MidpointHandle;
