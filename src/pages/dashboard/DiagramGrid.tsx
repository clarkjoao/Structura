import type { DiagramGridProps } from "@/pages/dashboard/dashboard.types";
import { DiagramCard } from "@/pages/dashboard/DiagramCard";
import { NewDiagramTile } from "@/pages/dashboard/NewDiagramTile";

export function DiagramGrid({
  diagrams,
  onSelect,
  isDiagramSelected,
  onDragStart,
  levelLabels,
  showNewDiagramTile = false,
  onNewDiagram,
  favoriteIds,
  onToggleFavorite,
}: DiagramGridProps) {
  if (diagrams.length === 0 && !showNewDiagramTile) return null;

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {diagrams.map((diagram, index) => (
        <DiagramCard
          key={diagram.id}
          diagram={diagram}
          index={index}
          isSelected={isDiagramSelected(diagram.id)}
          onSelect={onSelect}
          onDragStart={onDragStart}
          levelLabels={levelLabels}
          isFavorite={favoriteIds?.has(diagram.id) ?? false}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
      {showNewDiagramTile && onNewDiagram ? <NewDiagramTile onClick={onNewDiagram} /> : null}
    </div>
  );
}
