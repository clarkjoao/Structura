import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { isKindActive, resolveKindPolicy } from "./policy";
import type { KindMarker } from "./kind.types";

export interface KindMarkerSets {
  nodes: ReadonlySet<string>;
  connections: ReadonlySet<string>;
  markers: readonly KindMarker[];
}

const EMPTY: KindMarkerSets = { nodes: new Set(), connections: new Set(), markers: [] };
const cache = new WeakMap<
  object,
  { kindId: string; versions: unknown; activeVersionId: unknown; result: KindMarkerSets }
>();

/**
 * The active kind's quiet markers (ADR-0014), memoised on the snapshot's
 * identity (and the Version shown) so a render that changed nothing reads them
 * for free. Empty on a freehand diagram, a kind diagram edited freehand, and in
 * read-only surfaces (they never call this).
 */
export function kindMarkersFor(diagram: DiagramModel | null | undefined): KindMarkerSets {
  if (!diagram) return EMPTY;
  const policy = resolveKindPolicy(diagram);
  if (!isKindActive(policy) || !policy.descriptor.checks) return EMPTY;
  const hit = cache.get(diagram.snapshot);
  if (
    hit &&
    hit.kindId === policy.descriptor.id &&
    hit.versions === diagram.versions &&
    hit.activeVersionId === diagram.activeVersionId
  ) {
    return hit.result;
  }
  const markers = policy.descriptor.checks(diagram);
  const result: KindMarkerSets = {
    markers,
    nodes: new Set(markers.filter((m) => !m.onConnection).map((m) => m.elementId)),
    connections: new Set(markers.filter((m) => m.onConnection).map((m) => m.elementId)),
  };
  cache.set(diagram.snapshot, {
    kindId: policy.descriptor.id,
    versions: diagram.versions,
    activeVersionId: diagram.activeVersionId,
    result,
  });
  return result;
}
