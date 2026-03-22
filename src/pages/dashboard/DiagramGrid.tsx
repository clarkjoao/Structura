import type { DiagramGridProps } from "@/pages/dashboard/dashboard.types";
import { DiagramCard } from "@/pages/dashboard/DiagramCard";

export function DiagramGrid({
  diagrams,
  onOpen,
  onDragStart,
  levelLabels,
}: DiagramGridProps) {
  if (diagrams.length === 0) return null;
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {diagrams.map((d, i) => (
        <DiagramCard
          key={d.id}
          diagram={d}
          index={i}
          onOpen={onOpen}
          onDragStart={onDragStart}
          levelLabels={levelLabels}
        />
      ))}
    </div>
  );
}
