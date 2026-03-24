import type { Diagram, SceneDiff } from "../../model/diagram.types";

/** Active scene diff from `diagram` when `activeSceneId` is set and that entry exists in `diagram.scenes`; otherwise `null`. */
export function resolveActiveScene(diagram: Diagram): SceneDiff | null {
  const activeSceneId = diagram.activeSceneId ?? null;
  return activeSceneId && diagram.scenes?.[activeSceneId]
    ? diagram.scenes[activeSceneId]
    : null;
}
