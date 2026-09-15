import type { Component, Diagram, ServiceDefinition } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";
import { resolveUsedIconLibrary } from "./resolve-used-icons";
import { resolveUsedServices } from "./resolve-used-services";
import { createVersionedDiagram } from "@/infrastructure/persistence/versions";

/**
 * Base snapshot components plus any components that exist only inside scene
 * diffs. Used when collecting icons/services so a scene-only asset still
 * travels with the export. Does not flatten the diagram — SceneDiff stays a
 * delta over base.
 */
function componentsIncludingScenes(diagram: Diagram): Record<string, Component> {
  const merged: Record<string, Component> = { ...diagram.snapshot.components };
  for (const scene of Object.values(diagram.scenes ?? {})) {
    Object.assign(merged, scene.addedComponents);
  }
  return merged;
}

/**
 * Native JSON export — lossless for scenes.
 *
 * Always ships the base `snapshot` plus full `scenes` / `activeSceneId` /
 * `compareSceneId`. Does **not** call `diagramWithResolvedScene`: flattening
 * would either drop scenes or double-apply diffs on re-import. Draw.io /
 * Mermaid keep flattening because those formats cannot represent scenes.
 */
export function exportJSON(
  diagram: Diagram,
  serviceCatalog: Record<string, ServiceDefinition> = {},
): string {
  validateDiagram(diagram);
  const assetComponents = componentsIncludingScenes(diagram);
  const usedIconLibrary = resolveUsedIconLibrary(assetComponents);

  const diagramData = {
    ...diagram,
    snapshot: {
      ...diagram.snapshot,
      iconLibrary: usedIconLibrary,
    },
  };

  // The services travel next to the diagram, not inside it: a component only stores a
  // `serviceId`, which is local to the workspace that produced the file.
  const usedServices = resolveUsedServices(assetComponents, serviceCatalog);

  const versioned = createVersionedDiagram(diagramData, usedServices);
  return JSON.stringify(versioned, null, 2);
}

/**
 * Export a diagram without versioning (legacy format).
 * Use this only for internal storage, not for exports.
 */
export function exportJSONUnversioned(diagram: Diagram): string {
  validateDiagram(diagram);
  const assetComponents = componentsIncludingScenes(diagram);
  const usedIconLibrary = resolveUsedIconLibrary(assetComponents);
  const out = {
    ...diagram,
    snapshot: {
      ...diagram.snapshot,
      iconLibrary: usedIconLibrary,
    },
  };
  return JSON.stringify(out, null, 2);
}
