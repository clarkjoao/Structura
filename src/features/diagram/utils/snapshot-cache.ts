import type { Diagram, Component, Connection, NodeLayout } from "../model/diagram.types";
import { resolveCanvasSnapshot } from "./scene.utils";

export interface ResolvedSnapshot {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
}

/**
 * Cache by diagram id + input refs (not Diagram object identity). Immer replaces
 * the `Diagram` instance often; WeakMap<Diagram, …> had ~0 hit rate during editing.
 */
type SnapshotCacheEntry = {
  snapshot: unknown;
  nodeLayouts: unknown;
  scenes: unknown;
  activeSceneId: unknown;
  compareSceneId: unknown;
  result: ResolvedSnapshot;
};

const cacheByDiagramId = new Map<string, SnapshotCacheEntry>();

export function getCachedCanvasSnapshot(diagram: Diagram): ResolvedSnapshot {
  const hit = cacheByDiagramId.get(diagram.id);
  if (
    hit &&
    hit.snapshot === diagram.snapshot &&
    hit.nodeLayouts === diagram.nodeLayouts &&
    hit.scenes === diagram.scenes &&
    hit.activeSceneId === diagram.activeSceneId &&
    hit.compareSceneId === diagram.compareSceneId
  ) {
    return hit.result;
  }
  const resolved = resolveCanvasSnapshot(diagram);
  cacheByDiagramId.set(diagram.id, {
    snapshot: diagram.snapshot,
    nodeLayouts: diagram.nodeLayouts,
    scenes: diagram.scenes,
    activeSceneId: diagram.activeSceneId,
    compareSceneId: diagram.compareSceneId,
    result: resolved,
  });
  return resolved;
}
