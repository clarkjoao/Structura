import type { Diagram, ServiceDefinition } from "@/features/diagram";
import { diagramWithResolvedScene } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";
import { resolveUsedIconLibrary } from "./resolve-used-icons";
import { resolveUsedServices } from "./resolve-used-services";
import { createVersionedDiagram } from "@/infrastructure/persistence/versions";

export function exportJSON(
  diagram: Diagram,
  serviceCatalog: Record<string, ServiceDefinition> = {},
): string {
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

  // The services travel next to the diagram, not inside it: a component only stores a
  // `serviceId`, which is local to the workspace that produced the file.
  const usedServices = resolveUsedServices(resolved.snapshot.components, serviceCatalog);

  // Create versioned output
  const versioned = createVersionedDiagram(diagramData, usedServices);
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
