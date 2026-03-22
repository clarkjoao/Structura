import type { Diagram } from "@/features/diagram";
import { diagramWithResolvedScene } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";

export function exportJSON(diagram: Diagram): string {
  validateDiagram(diagram);
  // Full diagram snapshot is serialized, including `snapshot.iconLibrary` (spread in diagramWithResolvedScene).
  const out = diagramWithResolvedScene(diagram);
  return JSON.stringify(out, null, 2);
}
