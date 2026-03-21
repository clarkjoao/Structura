import type { Diagram } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";

export function exportJSON(diagram: Diagram): string {
  validateDiagram(diagram);
  return JSON.stringify(diagram, null, 2);
}
