import type { Component, Diagram, NodeLayout, VersionDiff } from "../../model/diagram.types";

export function resolveActiveVersion(diagram: Diagram): VersionDiff | null {
  const activeVersionId = diagram.activeVersionId ?? null;
  return activeVersionId && diagram.versions?.[activeVersionId]
    ? diagram.versions[activeVersionId]
    : null;
}

/** Escreve um componente e seu layout no contexto correto (scene ou base). */
export function writeComponentAndLayout(
  d: Diagram,
  scene: VersionDiff | null,
  comp: Component,
  layout: NodeLayout,
): void {
  if (scene) {
    scene.addedComponents[comp.id] = comp;
    scene.nodeLayouts[comp.id] = layout;
  } else {
    d.snapshot.components[comp.id] = comp;
    d.nodeLayouts[comp.id] = layout;
  }
}

/** Returns the component map for the active context (scene or base). */
export function getActiveComponents(
  d: Diagram,
  scene: VersionDiff | null,
): Record<string, Component> {
  return scene ? scene.addedComponents : d.snapshot.components;
}

/** Returns the layout map for the active context (scene or base). */
export function getActiveNodeLayouts(
  d: Diagram,
  scene: VersionDiff | null,
): Record<string, NodeLayout> {
  return scene ? scene.nodeLayouts : d.nodeLayouts;
}

/** Resolves a component by id in the active context, falling back to base. */
export function resolveComponent(
  d: Diagram,
  scene: VersionDiff | null,
  id: string,
): Component | undefined {
  return scene?.addedComponents[id] ?? d.snapshot.components[id];
}

/** Resolves a layout by id in the active context, falling back to base. */
export function resolveNodeLayout(
  d: Diagram,
  scene: VersionDiff | null,
  id: string,
): NodeLayout | undefined {
  return scene?.nodeLayouts[id] ?? d.nodeLayouts[id];
}
