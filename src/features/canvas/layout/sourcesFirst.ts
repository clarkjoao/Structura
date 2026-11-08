import type { LayoutGraph } from "./contract";

/**
 * Where a diagram starts: an element no connection enters is placed in the
 * first layer of its container, so nothing reads before it and the diagram
 * grows along the reading — right, or down in a top-to-bottom diagram —
 * rather than back from it.
 *
 * ELK's layering puts a source wherever its edges come out shortest, often
 * columns in, beside what it calls. Pinning it costs a little length (+13–22%)
 * and a few crossings (+3–6%) on the large diagrams, measured with references
 * by rules; in return every source starts its container's reading.
 *
 * A container counts as entered when a connection reaches anything inside it
 * from outside. An element with no connections at all is a source too: it
 * stacks in the first column instead of drifting into the middle.
 *
 * Computed on the diagram before references are made, so an original whose
 * incoming connections all moved onto references is not pinned for it.
 */
export function withSourcesFirst(graph: LayoutGraph): LayoutGraph {
  const parentOf = new Map(graph.nodes.map((node) => [node.id, node.parentId] as const));
  const chain = (id: string) => {
    const ids: string[] = [];
    for (let current = parentOf.get(id); current; current = parentOf.get(current)) {
      ids.push(current);
    }
    return ids;
  };
  const entered = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.sourceId === edge.targetId) continue;
    entered.add(edge.targetId);
    const from = new Set([edge.sourceId, ...chain(edge.sourceId)]);
    for (const ancestor of chain(edge.targetId)) {
      if (from.has(ancestor)) break;
      entered.add(ancestor);
    }
  }
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      entered.has(node.id) ? node : { ...node, firstLayer: true as const },
    ),
  };
}
