import { EdgeLabelRenderer } from "@xyflow/react";
import { useCollabHighlight } from "@/features/collaboration";
import type { Point } from "@/features/diagram";

interface CollabEdgeHighlightProps {
  edgeId: string;
  edgePath: string;
  labelPoint: Point;
}

/**
 * Renders a collaborator's highlight ring + name badge over an edge. Isolated
 * from the editing core so presence updates never recompute edge geometry.
 */
export function CollabEdgeHighlight({ edgeId, edgePath, labelPoint }: CollabEdgeHighlightProps) {
  const collabHighlight = useCollabHighlight(edgeId);
  if (!collabHighlight) return null;

  return (
    <>
      <path
        d={edgePath}
        strokeWidth={4}
        stroke={collabHighlight.color}
        fill="none"
        strokeOpacity={0.5}
        style={{ pointerEvents: "none" }}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute pointer-events-none z-[2] text-[9px] font-semibold
                     text-white px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{
            transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px)`,
            backgroundColor: collabHighlight.color,
          }}
        >
          {collabHighlight.userName}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
