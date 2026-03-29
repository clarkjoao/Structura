import type { Diagram } from "@/features/diagram";
import { diagramWithResolvedScene } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";
import { resolveUsedIconLibrary } from "./resolve-used-icons";

export function exportJSON(diagram: Diagram): string {
  validateDiagram(diagram);
  const resolved = diagramWithResolvedScene(diagram);
  const usedIconLibrary = resolveUsedIconLibrary(resolved.snapshot.components);
  const out = {
    ...resolved,
    snapshot: {
      ...resolved.snapshot,
      iconLibrary: usedIconLibrary,
    },
  };
  return JSON.stringify(out, null, 2);
}
