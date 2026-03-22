import type { Diagram } from "@/features/diagram";
import { diagramWithResolvedScene } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";

export function exportJSON(diagram: Diagram): string {
  validateDiagram(diagram);
  // Full diagram is serialized via spread in diagramWithResolvedScene (includes `edgeLayouts`, `snapshot.iconLibrary`, etc.).
  const out = diagramWithResolvedScene(diagram);
  return JSON.stringify(out, null, 2);
}
