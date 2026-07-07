import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "@/features/diagram";

const HANDLE_SIZE = 9;
const HANDLE_HIT_SIZE = 16;

interface CornerHandlesProps {
  corners: readonly Point[];
  activeCornerIndex: number | null;
  ariaLabel: (index: number) => string;
  onCornerPointerDown: (cornerIndex: number, event: ReactPointerEvent<SVGRectElement>) => void;
}

/**
 * draw.io-style square handles at each interior corner of an orthogonal edge.
 * Dragging a corner repositions it while keeping the route orthogonal. A wide
 * transparent hit rect sits under the visible square for a comfortable target.
 */
export function CornerHandles({
  corners,
  activeCornerIndex,
  ariaLabel,
  onCornerPointerDown,
}: CornerHandlesProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <>
      {corners.map((corner, index) => {
        const emphasized = activeCornerIndex === index || hoveredIndex === index;
        const active = activeCornerIndex === index;
        const size = active ? HANDLE_SIZE + 2 : HANDLE_SIZE;
        return (
          <g key={index}>
            <rect
              x={corner.x - size / 2}
              y={corner.y - size / 2}
              width={size}
              height={size}
              rx={1.5}
              fill={
                emphasized
                  ? "var(--color-text-info, hsl(187 72% 51%))"
                  : "var(--color-background, #fff)"
              }
              stroke="var(--color-text-info, hsl(187 72% 51%))"
              strokeWidth={1.5}
              style={{ pointerEvents: "none", transition: "fill 0.1s ease" }}
            />
            <rect
              x={corner.x - HANDLE_HIT_SIZE / 2}
              y={corner.y - HANDLE_HIT_SIZE / 2}
              width={HANDLE_HIT_SIZE}
              height={HANDLE_HIT_SIZE}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={ariaLabel(index)}
              className="nodrag nopan"
              style={{ pointerEvents: "all", cursor: "move", touchAction: "none" }}
              onPointerDown={(event) => onCornerPointerDown(index, event)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() =>
                setHoveredIndex((current) => (current === index ? null : current))
              }
            />
          </g>
        );
      })}
    </>
  );
}
