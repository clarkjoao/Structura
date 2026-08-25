import type { Component, Diagram } from "@/features/diagram";

export interface ServiceRelinkDecisions {
  /** Old (file-local) service id → the id it should point at in this workspace. */
  remap: Record<string, string>;
  /** File-local service ids whose dangling reference the user chose to drop. */
  clear: string[];
}

function rewriteComponents(
  components: Record<string, Component>,
  remap: Record<string, string>,
  clear: Set<string>,
): { components: Record<string, Component>; changed: boolean } {
  let changed = false;
  const next: Record<string, Component> = {};

  for (const [id, component] of Object.entries(components)) {
    const serviceId = component.serviceId;
    if (!serviceId) {
      next[id] = component;
      continue;
    }

    if (remap[serviceId]) {
      next[id] = { ...component, serviceId: remap[serviceId] };
      changed = true;
      continue;
    }

    if (clear.has(serviceId)) {
      next[id] = { ...component, serviceId: undefined };
      changed = true;
      continue;
    }

    next[id] = component;
  }

  return { components: next, changed };
}

/**
 * Rewrite the `serviceId` of every component the user accepted, on the in-memory diagram.
 *
 * Applying this before the import action keeps the whole import a single store write, so the
 * relink does not add per-component steps to the undo history. Scene components are walked
 * too: a file can carry scenes, and a component that only exists inside one would otherwise
 * keep the stale reference.
 */
export function applyServiceRelink(diagram: Diagram, decisions: ServiceRelinkDecisions): Diagram {
  const clear = new Set(decisions.clear);
  if (Object.keys(decisions.remap).length === 0 && clear.size === 0) return diagram;

  const base = rewriteComponents(diagram.snapshot.components, decisions.remap, clear);

  const scenes = diagram.scenes;
  let scenesChanged = false;
  let nextScenes = scenes;

  if (scenes) {
    const rewritten: NonNullable<Diagram["scenes"]> = {};
    for (const [sceneId, scene] of Object.entries(scenes)) {
      const result = rewriteComponents(scene.addedComponents ?? {}, decisions.remap, clear);
      if (result.changed) {
        scenesChanged = true;
        rewritten[sceneId] = { ...scene, addedComponents: result.components };
      } else {
        rewritten[sceneId] = scene;
      }
    }
    if (scenesChanged) nextScenes = rewritten;
  }

  if (!base.changed && !scenesChanged) return diagram;

  return {
    ...diagram,
    snapshot: { ...diagram.snapshot, components: base.components },
    ...(scenesChanged ? { scenes: nextScenes } : {}),
  };
}
