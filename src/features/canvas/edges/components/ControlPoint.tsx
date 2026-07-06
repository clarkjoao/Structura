import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { EdgeControlPoint } from "@/features/diagram";
import type { GhostMidpoint } from "../geometry/projection";

interface ControlPointProps {
  point: EdgeControlPoint;
  active: boolean;
  ariaLabel: string;
  onPointerDown: (pointId: string, event: ReactPointerEvent<SVGCircleElement>) => void;
  onRemove: (pointId: string) => void;
}

/** A solid, draggable control point. Double-click removes it. */
export function ControlPoint({
  point,
  active,
  ariaLabel,
  onPointerDown,
  onRemove,
}: ControlPointProps) {
  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={active ? 6 : 4.5}
      fill="var(--color-background, #fff)"
      stroke="var(--color-text-info, hsl(187 72% 51%))"
      strokeWidth={1.5}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className="nodrag nopan"
      style={{ pointerEvents: "all", cursor: "grab", touchAction: "none" }}
      onPointerDown={(event) => onPointerDown(point.id, event)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove(point.id);
      }}
    />
  );
}

interface GhostControlPointProps {
  ghost: GhostMidpoint;
  ariaLabel: string;
  onAdd: (insertIndex: number, position: { x: number; y: number }) => void;
}

/** A hollow midpoint affordance; clicking it inserts a new control point. */
export function GhostControlPoint({ ghost, ariaLabel, onAdd }: GhostControlPointProps) {
  const insert = (
    event: ReactMouseEvent<SVGCircleElement> | ReactPointerEvent<SVGCircleElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onAdd(ghost.insertIndex, { x: ghost.x, y: ghost.y });
  };
  return (
    <circle
      cx={ghost.x}
      cy={ghost.y}
      r={3.5}
      fill="var(--color-background, #fff)"
      stroke="var(--color-text-info, hsl(187 72% 51%))"
      strokeWidth={1}
      strokeOpacity={0.6}
      fillOpacity={0.5}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className="nodrag nopan"
      style={{ pointerEvents: "all", cursor: "copy", touchAction: "none" }}
      onPointerDown={insert}
    />
  );
}
