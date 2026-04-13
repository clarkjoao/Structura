import type { Diagram, DiagramModel } from "@/features/diagram";

export function validateDiagram(diagram: Diagram | DiagramModel): void {
  if (!diagram) {
    throw new Error("Diagram is required");
  }
  if (!diagram.snapshot) {
    throw new Error("Diagram snapshot is missing");
  }
  const { components, connections } = diagram.snapshot;
  if (!components || !connections) {
    throw new Error("Invalid diagram snapshot structure");
  }
}
