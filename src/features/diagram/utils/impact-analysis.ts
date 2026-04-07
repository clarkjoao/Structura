import type { Component, Connection } from "../model/diagram.types";

export interface ImpactResult {
  /** Nodes with an edge pointing into the removed node (reverse graph, hop 1). */
  directDependents: Component[];
  /** Further upstream nodes in the reverse BFS tree. */
  transitiveDependents: Component[];
  /** Connections incident on the removed node. */
  brokenConnections: Connection[];
}

/**
 * Impact of removing a node: reverse BFS over incoming edges (target → sources).
 * Pure function — no React or store access.
 */
export function computeImpact(
  nodeId: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): ImpactResult {
  const empty: ImpactResult = {
    directDependents: [],
    transitiveDependents: [],
    brokenConnections: [],
  };

  if (!nodeId || !components[nodeId]) {
    return empty;
  }

  const brokenConnections = Object.values(connections).filter(
    (connection) => connection.sourceId === nodeId || connection.targetId === nodeId,
  );

  const visited = new Set<string>([nodeId]);
  const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }];
  const directIds: string[] = [];
  const transitiveIds: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const connection of Object.values(connections)) {
      if (connection.targetId !== current.id) continue;
      const sourceId = connection.sourceId;
      if (visited.has(sourceId)) continue;
      visited.add(sourceId);
      const nextDepth = current.depth + 1;
      queue.push({ id: sourceId, depth: nextDepth });
      if (nextDepth === 1) {
        directIds.push(sourceId);
      } else {
        transitiveIds.push(sourceId);
      }
    }
  }

  const toComponent = (id: string): Component | undefined => components[id];

  return {
    directDependents: directIds.map(toComponent).filter((c): c is Component => !!c),
    transitiveDependents: transitiveIds.map(toComponent).filter((c): c is Component => !!c),
    brokenConnections,
  };
}
