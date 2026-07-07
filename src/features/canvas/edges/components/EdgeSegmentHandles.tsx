import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { StepSegment } from "../geometry/orthogonal";

const HIT_STROKE_WIDTH = 14;

interface EdgeSegmentHandlesProps {
  segments: StepSegment[];
  activeSegmentIndex: number | null;
  ariaLabel: (index: number) => string;
  onSegmentPointerDown: (segment: StepSegment, event: ReactPointerEvent<SVGLineElement>) => void;
}

/**
 * draw.io-style draggable segment handles for an orthogonal edge: a wide
 * invisible hit line per segment plus a highlight shown while hovering or
 * dragging. Corners stay square — dragging repositions the whole segment.
 */
export function EdgeSegmentHandles({
  segments,
  activeSegmentIndex,
  ariaLabel,
  onSegmentPointerDown,
}: EdgeSegmentHandlesProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <>
      {segments.map((segment) => {
        const emphasized = activeSegmentIndex === segment.index || hoveredIndex === segment.index;
        const active = activeSegmentIndex === segment.index;
        const cursor = segment.orientation === "horizontal" ? "ns-resize" : "ew-resize";
        return (
          <g key={segment.index}>
            <line
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke="var(--color-text-info, hsl(187 72% 51%))"
              strokeWidth={active ? 3 : 2}
              strokeOpacity={emphasized ? (active ? 0.9 : 0.5) : 0}
              strokeLinecap="round"
              style={{ pointerEvents: "none", transition: "stroke-opacity 0.1s ease" }}
            />
            <line
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke="transparent"
              strokeWidth={HIT_STROKE_WIDTH}
              strokeLinecap="round"
              role="button"
              tabIndex={0}
              aria-label={ariaLabel(segment.index)}
              className="nodrag nopan"
              style={{ pointerEvents: "stroke", cursor, touchAction: "none" }}
              onPointerDown={(event) => onSegmentPointerDown(segment, event)}
              onMouseEnter={() => setHoveredIndex(segment.index)}
              onMouseLeave={() =>
                setHoveredIndex((current) => (current === segment.index ? null : current))
              }
            />
          </g>
        );
      })}
    </>
  );
}
