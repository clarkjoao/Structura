import type { Diagram } from "@/features/diagram";
import { diagramWithResolvedScene } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";
import { resolveUsedIconLibrary } from "./resolve-used-icons";
import { createVersionedDiagram } from "@/infrastructure/persistence/versions";

export function exportJSON(diagram: Diagram): string {
  validateDiagram(diagram);
  const resolved = diagramWithResolvedScene(diagram);
  const usedIconLibrary = resolveUsedIconLibrary(resolved.snapshot.components);

  const diagramData = {
    ...resolved,
    snapshot: {
      ...resolved.snapshot,
      iconLibrary: usedIconLibrary,
    },
  };

  // Create versioned output
  const versioned = createVersionedDiagram(diagramData);
  return JSON.stringify(versioned, null, 2);
}

/**
 * Export a diagram without versioning (legacy format).
 * Use this only for internal storage, not for exports.
 */
export function exportJSONUnversioned(diagram: Diagram): string {
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
