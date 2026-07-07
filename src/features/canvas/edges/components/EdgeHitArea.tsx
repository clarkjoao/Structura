import type { MouseEvent as ReactMouseEvent } from "react";

const HIT_STROKE_WIDTH = 20;

interface EdgeHitAreaProps {
  edgePath: string;
  onHoverChange: (hovered: boolean) => void;
  onDoubleClick?: (event: ReactMouseEvent<SVGPathElement>) => void;
}

/**
 * A wide, transparent path that widens the edge's comfortable hover/hit target
 * without affecting its appearance. Selection itself is handled by React Flow's
 * built-in edge interaction path; this layer only drives hover affordances
 * (revealing control points) and the double-click-to-reset gesture.
 */
export function EdgeHitArea({ edgePath, onHoverChange, onDoubleClick }: EdgeHitAreaProps) {
  return (
    <path
      d={edgePath}
      fill="none"
      stroke="transparent"
      strokeWidth={HIT_STROKE_WIDTH}
      style={{ pointerEvents: "stroke", cursor: "pointer" }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onDoubleClick={onDoubleClick}
    />
  );
}
