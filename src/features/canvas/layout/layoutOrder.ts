import type { LayoutEdge, LayoutGraph, LayoutNode } from "./contract";

/**
 * The order ELK receives nodes and edges in, from what they are and not from
 * the ids they happen to carry. Ids are random, so sorting by them made the same
 * diagram lay out differently from one copy to the next.
 *
 * Nodes: `sortKey` (type and name, when the caller knows them), then where the
 * node is drawn now, then its size, then how connected it is. Ids only break a
 * tie between nodes that are otherwise identical, so the order stays total.
 * Edges: by the order of their ends, then label text, then id.
 */
export function orderLayoutGraph(graph: LayoutGraph): LayoutGraph {
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
  }
  const compareNodes = (a: LayoutNode, b: LayoutNode): number =>
    compareText(a.sortKey ?? "", b.sortKey ?? "") ||
    (a.position?.y ?? 0) - (b.position?.y ?? 0) ||
    (a.position?.x ?? 0) - (b.position?.x ?? 0) ||
    a.width - b.width ||
    a.height - b.height ||
    (degree.get(a.id) ?? 0) - (degree.get(b.id) ?? 0) ||
    compareText(a.id, b.id);

  const nodes = [...graph.nodes].sort(compareNodes);
  const rank = new Map(nodes.map((node, index) => [node.id, index]));
  const rankOf = (id: string): number => rank.get(id) ?? -1;
  const compareEdges = (a: LayoutEdge, b: LayoutEdge): number =>
    rankOf(a.sourceId) - rankOf(b.sourceId) ||
    rankOf(a.targetId) - rankOf(b.targetId) ||
    compareText(a.labelBox?.text ?? "", b.labelBox?.text ?? "") ||
    compareText(a.id, b.id);

  return { nodes, edges: [...graph.edges].sort(compareEdges) };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
