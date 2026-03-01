import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { DiffStatus } from "@/lib/model-diff";

export interface DiffEdgeData {
  label: string;
  technology?: string;
  diffStatus: DiffStatus;
}

const statusColors: Record<DiffStatus, string> = {
  added: "hsl(152 60% 45%)",
  removed: "hsl(0 72% 51%)",
  modified: "hsl(38 92% 50%)",
  unchanged: "hsl(220 20% 30%)",
};

const DiffEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}: EdgeProps) => {
  const d = data as unknown as DiffEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  const color = statusColors[d?.diffStatus ?? "unchanged"];

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: d?.diffStatus === "unchanged" ? 1.5 : 2.5,
          strokeDasharray: d?.diffStatus === "removed" ? "4 4" : d?.diffStatus === "unchanged" ? "6 4" : undefined,
          opacity: d?.diffStatus === "removed" ? 0.5 : 1,
        }}
      />
      {d?.label && (
        <EdgeLabelRenderer>
          <div
            className="absolute pointer-events-none"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <div className={`rounded-md px-2 py-1 text-[10px] font-medium border ${
              d.diffStatus === "added" ? "bg-success/15 border-success/30 text-success" :
              d.diffStatus === "removed" ? "bg-destructive/15 border-destructive/30 text-destructive line-through" :
              d.diffStatus === "modified" ? "bg-warning/15 border-warning/30 text-warning" :
              "bg-card border-border text-muted-foreground"
            }`}>
              {d.label}
              {d.technology && <span className="ml-1 font-mono opacity-60">[{d.technology}]</span>}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

DiffEdge.displayName = "DiffEdge";

export default DiffEdge;
