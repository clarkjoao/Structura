import type { ElkEdgeSection, ElkExtendedEdge, ElkNode } from "elkjs";

/**
 * Readability metric for a laid-out ELK graph.
 *
 * This is the instrument the layout configuration is tuned against: an option
 * stays only if it moves these numbers. It is deliberately independent of the
 * layout options themselves, so the same counter compares any two configs.
 *
 * Caveat worth knowing when reading the numbers: `edgeCrossings` counts ELK's
 * own routing, which is what the layout options actually change. The canvas
 * re-routes edges itself (React Flow step edges between handles), so the count
 * is a proxy for what the user sees, not a literal count of it.
 * `placementCrossings` is the routing-independent half — straight lines between
 * node centres — and tracks placement quality alone.
 */

export interface ReadabilityReport {
  /** Pairs of routed edge segments that properly cross. */
  edgeCrossings: number;
  /** Straight centre-to-centre crossings; independent of how edges are routed. */
  placementCrossings: number;
  /** Times a routed edge passes through a node box that is not its endpoint. */
  edgeNodeOverlaps: number;
  /** Overlapping edge-label boxes, plus labels sitting on top of a node. */
  labelOverlaps: number;
  nodeCount: number;
  edgeCount: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPSILON = 1e-6;

/**
 * Estimated size of a rendered edge label. The canvas draws labels as a small
 * pill at the middle of the path; ELK is never told about them, so the box is
 * derived from the text instead of measured.
 */
const LABEL_CHAR_WIDTH = 6.5;
const LABEL_PADDING_X = 16;
const LABEL_HEIGHT = 20;

interface WalkedGraph {
  boxes: Map<string, Box>;
  parentOf: Map<string, string | null>;
  edges: Array<{ id: string; source: string; target: string; points: Point[] }>;
}

function absoluteBoxes(graph: ElkNode): {
  boxes: Map<string, Box>;
  parentOf: Map<string, string | null>;
  rawEdges: Array<{ edge: ElkExtendedEdge; storedIn: string }>;
} {
  const boxes = new Map<string, Box>();
  const parentOf = new Map<string, string | null>();
  const rawEdges: Array<{ edge: ElkExtendedEdge; storedIn: string }> = [];

  const walk = (node: ElkNode, offsetX: number, offsetY: number, parent: string | null): void => {
    const x = offsetX + (node.x ?? 0);
    const y = offsetY + (node.y ?? 0);
    boxes.set(node.id, { x, y, width: node.width ?? 0, height: node.height ?? 0 });
    parentOf.set(node.id, parent);

    for (const edge of node.edges ?? []) {
      rawEdges.push({ edge: edge as ElkExtendedEdge, storedIn: node.id });
    }
    for (const child of node.children ?? []) {
      walk(child, x, y, node.id);
    }
  };

  walk(graph, 0, 0, null);
  return { boxes, parentOf, rawEdges };
}

function ancestorChain(id: string, parentOf: Map<string, string | null>): string[] {
  const chain: string[] = [];
  let current: string | null | undefined = id;
  while (current != null) {
    chain.push(current);
    current = parentOf.get(current);
  }
  return chain;
}

/**
 * ELK reports an edge's geometry relative to the lowest common ancestor of its
 * endpoints — *not* relative to the node whose `edges` array holds it. Verified
 * against elkjs 0.11: an edge declared on the root but running between two
 * siblings inside a container comes back in that container's coordinates.
 * Reading the points without this correction silently misplaces every nested
 * edge.
 */
function lowestCommonAncestor(
  a: string,
  b: string,
  parentOf: Map<string, string | null>,
): string | null {
  const chainB = new Set(ancestorChain(b, parentOf));
  for (const id of ancestorChain(a, parentOf)) {
    if (chainB.has(id)) return id;
  }
  return null;
}

function sectionPoints(section: ElkEdgeSection): Point[] {
  return [
    { x: section.startPoint.x, y: section.startPoint.y },
    ...(section.bendPoints ?? []).map((point) => ({ x: point.x, y: point.y })),
    { x: section.endPoint.x, y: section.endPoint.y },
  ];
}

function walkGraph(graph: ElkNode): WalkedGraph {
  const { boxes, parentOf, rawEdges } = absoluteBoxes(graph);
  const edges: WalkedGraph["edges"] = [];

  for (const { edge } of rawEdges) {
    const source = edge.sources?.[0];
    const target = edge.targets?.[0];
    if (source === undefined || target === undefined) continue;

    // Ports are children of their node in ELK's model but not in ours; fall back
    // to the port's owner when the endpoint id is not a node we walked.
    const sourceNode = boxes.has(source) ? source : (parentOf.get(source) ?? source);
    const targetNode = boxes.has(target) ? target : (parentOf.get(target) ?? target);

    const anchorId = lowestCommonAncestor(sourceNode, targetNode, parentOf) ?? graph.id;
    const anchor = boxes.get(anchorId) ?? { x: 0, y: 0, width: 0, height: 0 };

    const points: Point[] = [];
    for (const section of edge.sections ?? []) {
      for (const point of sectionPoints(section)) {
        points.push({ x: point.x + anchor.x, y: point.y + anchor.y });
      }
    }
    if (points.length < 2) continue;

    edges.push({ id: edge.id, source: sourceNode, target: targetNode, points });
  }

  return { boxes, parentOf, edges };
}

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    b.x <= Math.max(a.x, c.x) + EPSILON &&
    b.x >= Math.min(a.x, c.x) - EPSILON &&
    b.y <= Math.max(a.y, c.y) + EPSILON &&
    b.y >= Math.min(a.y, c.y) - EPSILON
  );
}

export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

/**
 * Two edges leaving the same node meet at that node's border; that shared point
 * is not a crossing. Only count an intersection when the edges do not share an
 * endpoint node, or when they do but the segments meet away from both ends.
 */
function countPolylineCrossings(
  edges: Array<{ source: string; target: string; points: Point[] }>,
): number {
  let crossings = 0;

  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const a = edges[i];
      const b = edges[j];
      const sharesNode =
        a.source === b.source ||
        a.source === b.target ||
        a.target === b.source ||
        a.target === b.target;

      let found = false;
      for (let s = 0; s < a.points.length - 1 && !found; s += 1) {
        for (let t = 0; t < b.points.length - 1 && !found; t += 1) {
          if (!segmentsIntersect(a.points[s], a.points[s + 1], b.points[t], b.points[t + 1])) {
            continue;
          }
          if (sharesNode) {
            const ends = [a.points[0], a.points[a.points.length - 1]];
            const otherEnds = [b.points[0], b.points[b.points.length - 1]];
            const touchesShared = ends.some((endpoint) =>
              otherEnds.some((other) => samePoint(endpoint, other)),
            );
            if (touchesShared) continue;
          }
          found = true;
        }
      }
      if (found) crossings += 1;
    }
  }

  return crossings;
}

function centreOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function segmentCrossesBox(p1: Point, p2: Point, box: Box): boolean {
  const corners: Point[] = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  for (let i = 0; i < 4; i += 1) {
    if (segmentsIntersect(p1, p2, corners[i], corners[(i + 1) % 4])) return true;
  }
  return false;
}

function isAncestorOf(candidate: string, node: string, parentOf: Map<string, string | null>) {
  return ancestorChain(node, parentOf).includes(candidate);
}

/**
 * A container legitimately has edges running through it — its own children are
 * inside it. Only leaf boxes that are not an endpoint, and not an ancestor of
 * either endpoint, count as an obstruction.
 */
function countEdgeNodeOverlaps(walked: WalkedGraph, rootId: string): number {
  let overlaps = 0;
  const hasChildren = new Set<string>();
  for (const [id, parent] of walked.parentOf) {
    if (parent !== null && parent !== undefined) hasChildren.add(parent);
    void id;
  }

  for (const edge of walked.edges) {
    for (const [nodeId, box] of walked.boxes) {
      if (nodeId === rootId) continue;
      if (nodeId === edge.source || nodeId === edge.target) continue;
      if (hasChildren.has(nodeId)) continue;
      if (isAncestorOf(nodeId, edge.source, walked.parentOf)) continue;
      if (isAncestorOf(nodeId, edge.target, walked.parentOf)) continue;

      for (let i = 0; i < edge.points.length - 1; i += 1) {
        if (segmentCrossesBox(edge.points[i], edge.points[i + 1], box)) {
          overlaps += 1;
          break;
        }
      }
    }
  }

  return overlaps;
}

function polylineMidpoint(points: Point[]): Point {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (travelled + length >= total / 2) {
      const ratio = length === 0 ? 0 : (total / 2 - travelled) / length;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    travelled += length;
  }
  return points[points.length - 1];
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function countLabelOverlaps(
  walked: WalkedGraph,
  labels: Map<string, string>,
  rootId: string,
): number {
  const labelBoxes: Box[] = [];
  for (const edge of walked.edges) {
    const text = labels.get(edge.id);
    if (!text) continue;
    const centre = polylineMidpoint(edge.points);
    const width = text.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X;
    labelBoxes.push({
      x: centre.x - width / 2,
      y: centre.y - LABEL_HEIGHT / 2,
      width,
      height: LABEL_HEIGHT,
    });
  }

  let overlaps = 0;
  for (let i = 0; i < labelBoxes.length; i += 1) {
    for (let j = i + 1; j < labelBoxes.length; j += 1) {
      if (boxesOverlap(labelBoxes[i], labelBoxes[j])) overlaps += 1;
    }
  }

  const leafBoxes: Box[] = [];
  const hasChildren = new Set<string>();
  for (const parent of walked.parentOf.values()) {
    if (parent !== null && parent !== undefined) hasChildren.add(parent);
  }
  for (const [id, box] of walked.boxes) {
    if (id !== rootId && !hasChildren.has(id)) leafBoxes.push(box);
  }
  for (const label of labelBoxes) {
    if (leafBoxes.some((box) => boxesOverlap(label, box))) overlaps += 1;
  }

  return overlaps;
}

function countPlacementCrossings(walked: WalkedGraph): number {
  const straight = walked.edges.map((edge) => {
    const source = walked.boxes.get(edge.source);
    const target = walked.boxes.get(edge.target);
    return {
      source: edge.source,
      target: edge.target,
      points:
        source && target
          ? [centreOf(source), centreOf(target)]
          : [edge.points[0], edge.points[edge.points.length - 1]],
    };
  });
  return countPolylineCrossings(straight);
}

export interface MeasureOptions {
  /** Edge id -> label text, used to size the estimated label boxes. */
  labels?: Map<string, string>;
}

export function measureReadability(
  graph: ElkNode,
  options: MeasureOptions = {},
): ReadabilityReport {
  const walked = walkGraph(graph);
  const labels = options.labels ?? new Map<string, string>();

  return {
    edgeCrossings: countPolylineCrossings(walked.edges),
    placementCrossings: countPlacementCrossings(walked),
    edgeNodeOverlaps: countEdgeNodeOverlaps(walked, graph.id),
    labelOverlaps: countLabelOverlaps(walked, labels, graph.id),
    nodeCount: walked.boxes.size - 1,
    edgeCount: walked.edges.length,
    width: Math.round(graph.width ?? 0),
    height: Math.round(graph.height ?? 0),
  };
}

/** Sums a set of per-diagram reports, for comparing whole configurations. */
export function totalReadability(reports: ReadabilityReport[]): ReadabilityReport {
  return reports.reduce<ReadabilityReport>(
    (accumulator, report) => ({
      edgeCrossings: accumulator.edgeCrossings + report.edgeCrossings,
      placementCrossings: accumulator.placementCrossings + report.placementCrossings,
      edgeNodeOverlaps: accumulator.edgeNodeOverlaps + report.edgeNodeOverlaps,
      labelOverlaps: accumulator.labelOverlaps + report.labelOverlaps,
      nodeCount: accumulator.nodeCount + report.nodeCount,
      edgeCount: accumulator.edgeCount + report.edgeCount,
      width: Math.max(accumulator.width, report.width),
      height: Math.max(accumulator.height, report.height),
    }),
    {
      edgeCrossings: 0,
      placementCrossings: 0,
      edgeNodeOverlaps: 0,
      labelOverlaps: 0,
      nodeCount: 0,
      edgeCount: 0,
      width: 0,
      height: 0,
    },
  );
}
