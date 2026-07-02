import type { MouseEvent } from "react";
import type { Diagram, ServiceDefinition, ServiceSource } from "@/features/diagram";

export interface ServiceCardProps {
  svc: ServiceDefinition;
  isSelected: boolean;
  isBulkSelected: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  usage: { diagramId: string; diagramName: string; nodeCount: number }[];
}

export interface DetailPanelProps {
  svc: ServiceDefinition;
  diagrams: Record<string, Diagram>;
  onNavigateToDiagram: (diagramId: string, serviceId: string) => void;
  updateService: (id: string, patch: Partial<Omit<ServiceDefinition, "id">>) => void;
  removeService: (id: string) => void;
  onClose: () => void;
}

export type SourceFilter = "all" | ServiceSource;
