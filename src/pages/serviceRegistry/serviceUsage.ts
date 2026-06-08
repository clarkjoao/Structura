import type { Diagram } from "@/features/diagram";
import { findComponentIdsByServiceId } from "./findComponentsByServiceId";

export function getServiceUsage(
  serviceId: string,
  diagrams: Record<string, Diagram>,
): { diagramId: string; diagramName: string; nodeCount: number }[] {
  return Object.values(diagrams)
    .map((diagram) => {
      const componentIds = findComponentIdsByServiceId(diagram, serviceId);
      return componentIds.length > 0
        ? {
            diagramId: diagram.id,
            diagramName: diagram.name,
            nodeCount: componentIds.length,
          }
        : null;
    })
    .filter(
      (x): x is { diagramId: string; diagramName: string; nodeCount: number } =>
        x !== null,
    );
}
