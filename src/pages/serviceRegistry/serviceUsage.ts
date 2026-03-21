import type { Diagram } from "@/features/diagram";

export function getServiceUsage(
  serviceId: string,
  diagrams: Record<string, Diagram>,
): { diagramId: string; diagramName: string; nodeCount: number }[] {
  return Object.values(diagrams)
    .map((diagram) => {
      const nodes = Object.values(diagram.snapshot.components).filter(
        (c) => c.serviceId === serviceId,
      );
      return nodes.length > 0
        ? {
            diagramId: diagram.id,
            diagramName: diagram.name,
            nodeCount: nodes.length,
          }
        : null;
    })
    .filter(
      (x): x is { diagramId: string; diagramName: string; nodeCount: number } =>
        x !== null,
    );
}
