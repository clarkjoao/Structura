import { Position } from "@xyflow/react";
import type { Point } from "@/features/diagram";
import { MAX_HANDLES, MIN_HANDLES } from "../canvas.constants";
import { defaultOrthogonalCorners } from "../edges/geometry/orthogonal";
import {
  measurePolylines,
  readLaidOutGraph,
  type ReadabilityBox,
  type ReadabilityReport,
} from "./layoutReadability";
import type { ElkNode } from "elkjs";

/**
 * The polyline the canvas actually draws for a generated connection.
 *
 * Neither of the ELK-side numbers is what the user sees: ELK's routed path is
 * discarded by `apply-ir.ts`, and the straight centre-to-centre line is only a
 * placement proxy. Generated connections render as `EdgeStyle.EditableStep`,
 * whose path comes from the node handles plus `defaultOrthogonalCorners`. This
 * module reproduces that, reusing the canvas's own corner function, so the
 * measurement tracks the rendered result rather than an idealised one.
 */

/**
 * Handle anchor, matching `buildHandles`: `n` handles clamped to [1, 4], handle
 * `i` at `(i + 1) / (n + 1)` of the node height. A single handle sits at the
 * default 50%, which the same formula yields for n = 1.
 */
export function handleAnchor(
  box: ReadabilityBox,
  side: "source" | "target",
  slot: number,
  count: number,
): Point {
  const n = Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, count));
  const index = Math.min(Math.max(slot, 0), n - 1);
  return {
    x: side === "source" ? box.x + box.width : box.x,
    y: box.y + box.height * ((index + 1) / (n + 1)),
  };
}

/**
 * Expands the knots into the points the SVG path visits. `buildStepPath` emits
 * `H x V y` per knot, so each leg is an L: horizontal first, then vertical.
 * Kept in step with that function by `renderedEdgePath.test.ts`, which compares
 * these points against the path string it produces.
 */
export function stepPolyline(source: Point, target: Point, corners: readonly Point[]): Point[] {
  const knots: Point[] = [source, ...corners, target];
  const points: Point[] = [{ x: knots[0].x, y: knots[0].y }];
  let current = points[0];

  for (let i = 1; i < knots.length; i += 1) {
    const knot = knots[i];
    if (knot.x !== current.x) {
      current = { x: knot.x, y: current.y };
      points.push(current);
    }
    if (knot.y !== current.y) {
      current = { x: current.x, y: knot.y };
      points.push(current);
    }
  }

  return points;
}

export interface RenderedEdgeInput {
  id: string;
  sourceId: string;
  targetId: string;
  /** Interior control points, in absolute canvas coordinates. */
  corners?: Point[];
}

/**
 * Mirrors `buildEdgeHandleAssignments`: handles are handed out round-robin in
 * connection order, capped at MAX_HANDLES.
 */
function assignHandleSlots(
  edges: RenderedEdgeInput[],
): Map<string, { source: number; target: number }> {
  const outgoing: Record<string, number> = {};
  const incoming: Record<string, number> = {};
  for (const edge of edges) {
    outgoing[edge.sourceId] = (outgoing[edge.sourceId] ?? 0) + 1;
    incoming[edge.targetId] = (incoming[edge.targetId] ?? 0) + 1;
  }

  const sourceUsage: Record<string, number> = {};
  const targetUsage: Record<string, number> = {};
  const slots = new Map<string, { source: number; target: number }>();

  for (const edge of edges) {
    const outCount = Math.min(MAX_HANDLES, Math.max(1, outgoing[edge.sourceId] ?? 1));
    const inCount = Math.min(MAX_HANDLES, Math.max(1, incoming[edge.targetId] ?? 1));
    const sourceSlot = (sourceUsage[edge.sourceId] ?? 0) % outCount;
    const targetSlot = (targetUsage[edge.targetId] ?? 0) % inCount;
    sourceUsage[edge.sourceId] = (sourceUsage[edge.sourceId] ?? 0) + 1;
    targetUsage[edge.targetId] = (targetUsage[edge.targetId] ?? 0) + 1;
    slots.set(edge.id, { source: sourceSlot, target: targetSlot });
  }

  return slots;
}

export interface RenderedPolyline {
  id: string;
  source: string;
  target: string;
  points: Point[];
}

/** Builds the drawn polyline for every edge, from absolute node boxes. */
export function buildRenderedPolylines(
  boxes: Map<string, ReadabilityBox>,
  edges: RenderedEdgeInput[],
): RenderedPolyline[] {
  const slots = assignHandleSlots(edges);
  const outgoing: Record<string, number> = {};
  const incoming: Record<string, number> = {};
  for (const edge of edges) {
    outgoing[edge.sourceId] = (outgoing[edge.sourceId] ?? 0) + 1;
    incoming[edge.targetId] = (incoming[edge.targetId] ?? 0) + 1;
  }

  const result: RenderedPolyline[] = [];
  for (const edge of edges) {
    const sourceBox = boxes.get(edge.sourceId);
    const targetBox = boxes.get(edge.targetId);
    if (!sourceBox || !targetBox) continue;

    const slot = slots.get(edge.id) ?? { source: 0, target: 0 };
    const source = handleAnchor(sourceBox, "source", slot.source, outgoing[edge.sourceId] ?? 1);
    const target = handleAnchor(targetBox, "target", slot.target, incoming[edge.targetId] ?? 1);
    const corners =
      edge.corners && edge.corners.length > 0
        ? edge.corners
        : defaultOrthogonalCorners(source, target, Position.Right);

    result.push({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      points: stepPolyline(source, target, corners),
    });
  }

  return result;
}

export interface RenderedMeasureOptions {
  labels?: Map<string, string>;
  /** Control points per edge id, as applying ELK waypoints would store them. */
  cornersByEdgeId?: Map<string, Point[]>;
}

/**
 * Measures the rendered result for a laid-out graph: node positions come from
 * ELK, edge paths from the canvas's own routing.
 */
export function measureRenderedReadability(
  graph: ElkNode,
  edges: Array<{ id: string; sourceId: string; targetId: string }>,
  options: RenderedMeasureOptions = {},
): ReadabilityReport {
  const { boxes, parentOf } = readLaidOutGraph(graph);

  const inputs: RenderedEdgeInput[] = edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    ...(options.cornersByEdgeId?.has(edge.id)
      ? { corners: options.cornersByEdgeId.get(edge.id) }
      : {}),
  }));

  return measurePolylines(
    {
      boxes,
      parentOf,
      edges: buildRenderedPolylines(boxes, inputs),
      rootId: graph.id,
      width: graph.width ?? 0,
      height: graph.height ?? 0,
    },
    { ...(options.labels ? { labels: options.labels } : {}) },
  );
}
