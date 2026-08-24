import type { LayoutBox } from "../layout/graphLayoutEngine";
import { buildRenderedPolylines } from "../layout/renderedEdgePath";

/**
 * Keeps edge labels off each other and off the nodes.
 *
 * The canvas draws a label at the middle of its path, and two edges can share a
 * midpoint exactly — which is what the ASL reference solution does: a queue
 * feeding an application and a stream feeding a processor cross at the same
 * point, so both labels land on the same pixel. More spacing does not help,
 * because scaling the layout moves both midpoints together.
 *
 * `ConnectionStyle.labelPosition` is the product's own answer to this (the same
 * field a user changes by dragging a label), so the fix is to pick a position
 * other than the middle for the label that would collide, rather than to alter
 * the layout.
 */

const LABEL_CHAR_WIDTH = 6.5;
const LABEL_PADDING_X = 16;
const LABEL_HEIGHT = 20;

/** The middle first: a label only moves when staying put would collide. */
const CANDIDATE_POSITIONS = [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85];

interface Point {
  x: number;
  y: number;
}

function boxesOverlap(a: LayoutBox, b: LayoutBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Point at normalized arc-length `t` along a polyline. */
export function pointAtRatio(points: readonly Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  if (total === 0) return points[0];

  const target = total * t;
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (travelled + length >= target) {
      const ratio = length === 0 ? 0 : (target - travelled) / length;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    travelled += length;
  }
  return points[points.length - 1];
}

function labelBox(centre: Point, text: string): LayoutBox {
  const width = text.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X;
  return {
    x: centre.x - width / 2,
    y: centre.y - LABEL_HEIGHT / 2,
    width,
    height: LABEL_HEIGHT,
  };
}

export interface SpreadLabelsInput {
  /** Canvas-absolute boxes, keyed by node id. */
  absoluteBoxes: ReadonlyMap<string, LayoutBox>;
  parentOf: ReadonlyMap<string, string | null>;
  /**
   * Ids of container nodes (panels, compound nodes) whose interior is not an
   * obstacle for a label. A node is a leaf only when it is NOT in this set
   * AND has no children — whether something is a leaf comes from the layout
   * graph, not from the parent-of chain (which also marks non-container parents).
   */
  containerIds?: ReadonlySet<string>;
  edges: ReadonlyArray<{ id: string; sourceId: string; targetId: string }>;
  labels: ReadonlyMap<string, string>;
}

/**
 * Returns the label position per edge id, for the edges that need to move off
 * the middle. An edge absent from the map keeps the default.
 *
 * Containers are not obstacles: a label drawn over a panel's empty interior is
 * how every nested diagram reads, and the readability counter agrees — it only
 * scores a label sitting on a leaf.
 */
export function resolveLabelPositions(input: SpreadLabelsInput): Map<string, number> {
  const { absoluteBoxes, parentOf, containerIds, edges, labels } = input;

  const hasChildren = new Set<string>();
  for (const parent of parentOf.values()) {
    if (parent !== null && parent !== undefined) hasChildren.add(parent);
  }
  // A node is a leaf for label-obstacle purposes if it has no children AND is
  // not a container. The parent-of chain marks non-container parents as well;
  // `containerIds` (from the layout graph's `isContainer` field) tells them apart.
  const leafBoxes: LayoutBox[] = [];
  for (const [id, box] of absoluteBoxes) {
    if (!hasChildren.has(id) && !containerIds?.has(id)) leafBoxes.push(box);
  }

  const polylines = buildRenderedPolylines(
    absoluteBoxes,
    edges.map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId })),
    {},
  );

  const placed: LayoutBox[] = [];
  const positions = new Map<string, number>();

  for (const polyline of polylines) {
    const text = labels.get(polyline.id);
    if (text === undefined || text === "") continue;

    let chosen = CANDIDATE_POSITIONS[0];
    let chosenBox = labelBox(pointAtRatio(polyline.points, chosen), text);

    for (const candidate of CANDIDATE_POSITIONS) {
      const box = labelBox(pointAtRatio(polyline.points, candidate), text);
      const collides =
        placed.some((other) => boxesOverlap(box, other)) ||
        leafBoxes.some((other) => boxesOverlap(box, other));
      if (!collides) {
        chosen = candidate;
        chosenBox = box;
        break;
      }
    }

    placed.push(chosenBox);
    if (chosen !== CANDIDATE_POSITIONS[0]) {
      positions.set(polyline.id, chosen);
    }
  }

  return positions;
}
