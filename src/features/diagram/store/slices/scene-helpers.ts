import type { Diagram, SceneDiff } from "../../model/diagram.types";


export function resolveActiveScene(diagram: Diagram): SceneDiff | null {
  const activeSceneId = diagram.activeSceneId ?? null;
  return activeSceneId && diagram.scenes?.[activeSceneId]
    ? diagram.scenes[activeSceneId]
    : null;
}
