import type { MouseEvent, DragEvent } from "react";
import type { Component, Diagram, Level } from "@/features/diagram";

export type SortKey = "name" | "domain" | "level" | "updatedAt";
export type ViewMode = "grid" | "list";

export interface DiagramGridProps {
  diagrams: Diagram[];
  onSelect: (d: Diagram, event: MouseEvent<HTMLElement>) => void;
  isDiagramSelected: (id: string) => boolean;
  onDragStart: (e: DragEvent, id: string) => void;
  levelLabels: Record<string, string>;
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
  onAdd: (name: string, level: Level, domain?: string) => void;
}

export type GlobalSearchHit = Component & {
  diagramId: string;
  diagramName: string;
};
