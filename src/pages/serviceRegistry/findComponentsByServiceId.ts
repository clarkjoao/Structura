import type { Diagram } from "@/features/diagram";

export function findComponentIdsByServiceId(
  diagram: Diagram,
  serviceId: string,
): string[] {
  return Object.values(diagram.snapshot.components)
    .filter((component) => component.serviceId === serviceId)
    .map((component) => component.id);
}
