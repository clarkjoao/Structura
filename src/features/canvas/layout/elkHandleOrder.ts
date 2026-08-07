import type { ElkNode } from "elkjs";
import { readLaidOutGraph } from "./layoutReadability";

/**
 * The edge ordering ELK chose at each node, read off its routed attachment
 * points.
 *
 * ELK spreads an edge's endpoints along the node border and sorts them to
 * minimise crossings — verified against elkjs 0.11: a hub with five outgoing
 * edges gets five distinct attachment heights, ordered to match the vertical
 * order of the targets. Declaring ports is not needed to get this (and
 * `elk.portConstraints` without ports is inert, also verified).
 *
 * Structura throws that ordering away: `buildEdgeHandleAssignments` hands out
 * handles round-robin in connection order, which is uncorrelated with where the
 * other end sits. This module recovers ELK's order so it can be fed into the
 * `handleOrder` field the canvas already honours.
 */

export interface ElkHandleOrder {
  /** node id -> edge ids, top to bottom along the node's outgoing side. */
  outgoing: Map<string, string[]>;
  /** node id -> edge ids, top to bottom along the node's incoming side. */
  incoming: Map<string, string[]>;
}

interface Attachment {
  edgeId: string;
  y: number;
  x: number;
}

function orderedIds(attachments: Attachment[]): string[] {
  return (
    [...attachments]
      // Top to bottom; x then edge id only to keep ties deterministic.
      .sort((a, b) => a.y - b.y || a.x - b.x || a.edgeId.localeCompare(b.edgeId))
      .map((attachment) => attachment.edgeId)
  );
}

export function readElkHandleOrder(graph: ElkNode): ElkHandleOrder {
  const { edges } = readLaidOutGraph(graph);

  const outgoingByNode = new Map<string, Attachment[]>();
  const incomingByNode = new Map<string, Attachment[]>();

  const push = (map: Map<string, Attachment[]>, nodeId: string, attachment: Attachment): void => {
    const list = map.get(nodeId);
    if (list) list.push(attachment);
    else map.set(nodeId, [attachment]);
  };

  for (const edge of edges) {
    const start = edge.points[0];
    const end = edge.points[edge.points.length - 1];
    if (!start || !end) continue;
    push(outgoingByNode, edge.source, { edgeId: edge.id, y: start.y, x: start.x });
    push(incomingByNode, edge.target, { edgeId: edge.id, y: end.y, x: end.x });
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const [nodeId, attachments] of outgoingByNode) {
    outgoing.set(nodeId, orderedIds(attachments));
  }
  for (const [nodeId, attachments] of incomingByNode) {
    incoming.set(nodeId, orderedIds(attachments));
  }

  return { outgoing, incoming };
}
