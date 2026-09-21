import type { MouseEvent, DragEvent } from "react";
import type { Component, Diagram, Level } from "@/features/diagram";

export type SortKey = "name" | "domain" | "level" | "updatedAt";
/** One definition, shared with the walkthrough library via the filter toolbar. */
export type { ViewMode } from "@/components/filters/LibraryFilterToolbar";
export type ContentFilter = "all" | "recent" | "favorites";

export interface DiagramGridProps {
  diagrams: Diagram[];
  onSelect: (d: Diagram, event: MouseEvent<HTMLElement>) => void;
  isDiagramSelected: (id: string) => boolean;
  onDragStart: (e: DragEvent, id: string) => void;
  levelLabels: Record<string, string>;
  showNewDiagramTile?: boolean;
  onNewDiagram?: () => void;
  favoriteIds?: ReadonlySet<string>;
  onToggleFavorite?: (diagramId: string) => void;
}

export interface DiagramListProps {
  diagrams: Diagram[];
  onOpen: (d: Diagram) => void;
  onDelete: (e: MouseEvent, id: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  levelLabels: Record<string, string>;
}

export interface AddDiagramDialogProps {
  onClose: () => void;
  onAdd: (name: string, level: Level, domain?: string, description?: string) => void;
}

export type GlobalSearchHit = Component & {
  diagramId: string;
  diagramName: string;
};
