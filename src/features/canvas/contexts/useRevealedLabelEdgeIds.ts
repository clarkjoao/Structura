import { useMemo, useRef } from "react";

type ConnectionEnds = { id: string; sourceId: string; targetId: string };

const NO_REVEALED_EDGES: ReadonlySet<string> = new Set();

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * The edges whose label is revealed because one of their ends is selected —
 * the value of `EdgeLabelRevealContext`, which every edge on the canvas reads.
 *
 * It is recomputed whenever the diagram changes, which is every store write,
 * but its identity only moves when its members do. A fresh `Set` per write made
 * every edge re-render on every write — moving one node with an arrow key
 * re-rendered all 711 edges of the large-diagram fixture, twice.
 */
export function useRevealedLabelEdgeIds(
  connections: Readonly<Record<string, ConnectionEnds>> | null | undefined,
  selectedNodeIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const previous = useRef<ReadonlySet<string>>(NO_REVEALED_EDGES);
  return useMemo(() => {
    let next: ReadonlySet<string> = NO_REVEALED_EDGES;
    if (connections && selectedNodeIds.size > 0) {
      const ids = new Set<string>();
      for (const connection of Object.values(connections)) {
        if (selectedNodeIds.has(connection.sourceId) || selectedNodeIds.has(connection.targetId)) {
          ids.add(connection.id);
        }
      }
      if (ids.size > 0) next = ids;
    }
    if (sameMembers(next, previous.current)) return previous.current;
    previous.current = next;
    return next;
  }, [connections, selectedNodeIds]);
}
