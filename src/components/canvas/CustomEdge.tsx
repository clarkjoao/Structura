import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";

export interface EdgeData {
  label: string;
  technology?: string;
  connectionId: string;
  recordingBadges?: number[];
  isLastRecorded?: boolean;
}

const Edge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    selected,
    sourcePosition,
    targetPosition,
  }: EdgeProps) => {
    const d = data as unknown as EdgeData;
    const [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: selected ? "hsl(187 72% 51%)" : "hsl(220 20% 30%)",
            strokeWidth: selected ? 2 : 1.5,
            strokeDasharray: selected ? undefined : "6 4",
          }}
        />
        {d?.label && (
          <EdgeLabelRenderer>
            <div
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              }}
            >
              <div
                className={`relative rounded-md px-2 py-1 text-[10px] font-medium border transition-colors ${
                  selected
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
                {d?.recordingBadges && d.recordingBadges.length > 0 && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-0.5 ${d.isLastRecorded ? "animate-pulse" : ""}`}>
                    {d.recordingBadges.join(",")}
                  </div>
                )}
                {d.label}
                {d.technology && (
                  <span className="ml-1 font-mono opacity-60">
                    [{d.technology}]
                  </span>
                )}
              </div>
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  },
);

Edge.displayName = "Edge";

export default Edge;
