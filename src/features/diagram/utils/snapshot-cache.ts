import type { Diagram, Component, Connection, NodeLayout } from "../model/diagram.types";
import { resolveCanvasSnapshot } from "./scene.utils";

export interface ResolvedSnapshot {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
}

const cache = new WeakMap<Diagram, ResolvedSnapshot>();


export function getCachedCanvasSnapshot(diagram: Diagram): ResolvedSnapshot {
  const hit = cache.get(diagram);
  if (hit) return hit;
  const resolved = resolveCanvasSnapshot(diagram);
  cache.set(diagram, resolved);
  return resolved;
}
