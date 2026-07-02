import type { Component, Diagram, NodeLayout, SceneDiff } from "../../model/diagram.types";

export function resolveActiveScene(diagram: Diagram): SceneDiff | null {
  const activeSceneId = diagram.activeSceneId ?? null;
  return activeSceneId && diagram.scenes?.[activeSceneId] ? diagram.scenes[activeSceneId] : null;
}

/** Escreve um componente e seu layout no contexto correto (scene ou base). */
export function writeComponentAndLayout(
  d: Diagram,
  scene: SceneDiff | null,
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

/** Retorna o mapa de componentes do contexto ativo (scene ou base). */
export function getActiveComponents(
  d: Diagram,
  scene: SceneDiff | null,
): Record<string, Component> {
  return scene ? scene.addedComponents : d.snapshot.components;
}

/** Retorna o mapa de layouts do contexto ativo (scene ou base). */
export function getActiveNodeLayouts(
  d: Diagram,
  scene: SceneDiff | null,
): Record<string, NodeLayout> {
  return scene ? scene.nodeLayouts : d.nodeLayouts;
}

/** Resolve um componente pelo id no contexto ativo, com fallback para base. */
export function resolveComponent(
  d: Diagram,
  scene: SceneDiff | null,
  id: string,
): Component | undefined {
  return scene?.addedComponents[id] ?? d.snapshot.components[id];
}

/** Resolve um layout pelo id no contexto ativo, com fallback para base. */
export function resolveNodeLayout(
  d: Diagram,
  scene: SceneDiff | null,
  id: string,
): NodeLayout | undefined {
  return scene?.nodeLayouts[id] ?? d.nodeLayouts[id];
}
