import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export interface C4EdgeData {
  label: string;
  technology?: string;
  connectionId: string;
}

const C4Edge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  }: EdgeProps) => {
    const d = data as unknown as C4EdgeData;
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
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
                className={`rounded-md px-2 py-1 text-[10px] font-medium border transition-colors ${
                  selected
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
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

C4Edge.displayName = "C4Edge";

export default C4Edge;
