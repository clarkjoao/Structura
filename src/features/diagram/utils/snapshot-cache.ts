import type {
  Diagram,
  DiagramModel,
  Component,
  Connection,
  NodeLayout,
} from "../model/diagram.types";
import { resolveCanvasSnapshot } from "./version.utils";

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
  versions: unknown;
  activeVersionId: unknown;
  compareVersionId: unknown;
  result: ResolvedSnapshot;
};

const cacheByDiagramId = new Map<string, SnapshotCacheEntry>();

export function getCachedCanvasSnapshot(diagram: Diagram | DiagramModel): ResolvedSnapshot {
  const hit = cacheByDiagramId.get(diagram.id);
  if (
    hit &&
    hit.snapshot === diagram.snapshot &&
    hit.nodeLayouts === diagram.nodeLayouts &&
    hit.versions === diagram.versions &&
    hit.activeVersionId === diagram.activeVersionId &&
    hit.compareVersionId === diagram.compareVersionId
  ) {
    return hit.result;
  }
  const resolved = resolveCanvasSnapshot(diagram);
  cacheByDiagramId.set(diagram.id, {
    snapshot: diagram.snapshot,
    nodeLayouts: diagram.nodeLayouts,
    versions: diagram.versions,
    activeVersionId: diagram.activeVersionId,
    compareVersionId: diagram.compareVersionId,
    result: resolved,
  });
  return resolved;
}
