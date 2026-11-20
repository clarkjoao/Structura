import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindArrangement, KindContext, KindLayoutServices } from "../kind.types";
import { type GuidedReading, readGuided } from "./guided.model";
import {
  LANE_HEADER,
  LANE_INSET,
  LANE_MIN_DEPTH,
  LANE_MIN_LENGTH,
  LANE_PADDING,
  stepSize,
} from "./guided.geometry";

/**
 * The lane-banded arrangement (spec guided-flow-layout, design D6).
 *
 * 1. Order: a longest-path layering of the step graph gives each step a layer
 *    (column) and an order within it. Back-edges (retries) are found by a walk
 *    from the start and left out of the layering, so a loop never pushes the
 *    steps it returns to.
 * 2. Placement: columns run along the reading axis, as wide as their widest
 *    step; lanes are bands across it, each as deep as its tallest column
 *    stack; steps sharing a lane and a column stack in layer order.
 *
 * Written along/across and mapped to x/y at the end, so top-to-bottom is the
 * same arrangement mirrored rather than a second one. The bands start where the
 * lanes already start, so the diagram does not jump.
 */
export async function arrangeGuided(
  diagram: DiagramModel,
  _ctx: KindContext,
  services: KindLayoutServices,
): Promise<KindArrangement> {
  return arrangeGuidedSync(diagram, services);
}

/** The arrangement itself: synchronous, deterministic, pure. */
export function arrangeGuidedSync(
  diagram: DiagramModel,
  services: Pick<KindLayoutServices, "measured" | "gaps">,
): KindArrangement {
  const reading = readGuided(diagram);
  if (reading.lanes.length === 0) return { layouts: [] };
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const vertical = diagram.direction === "TB";

  // Sizes as painted when the canvas measured them, else as stored, else the shape's default.
  const sizeOf = (id: string) => {
    const measured = services.measured[id];
    if (measured) return measured;
    const layout = nodeLayouts[id];
    const step = reading.steps.get(id);
    const fallback = step ? stepSize(step.flowShape) : { width: 220, height: 80 };
    return {
      width: layout?.width ?? fallback.width,
      height: layout?.height ?? fallback.height,
    };
  };
  const along = (id: string) => (vertical ? sizeOf(id).height : sizeOf(id).width);
  const across = (id: string) => (vertical ? sizeOf(id).width : sizeOf(id).height);

  const { layer: layerOfStep, order: orderOfStep } = layerSteps(reading, (id) => {
    const layout = nodeLayouts[id];
    return vertical ? (layout?.y ?? 0) : (layout?.x ?? 0);
  });
  const stepIds = [...reading.steps.keys()].sort();
  const order: Record<string, { layer: number; order: number }> = {};
  for (const id of stepIds)
    order[id] = { layer: layerOfStep.get(id) ?? 0, order: orderOfStep.get(id) ?? 0 };

  // Columns.
  const layerOf = (id: string) => order[id]?.layer ?? 0;
  const columnCount = stepIds.reduce((max, id) => Math.max(max, layerOf(id) + 1), 0);
  const columnWidth = Array.from({ length: columnCount }, () => 0);
  for (const id of stepIds)
    columnWidth[layerOf(id)] = Math.max(columnWidth[layerOf(id)]!, along(id));
  const columnStart: number[] = [];
  let cursor = LANE_HEADER + LANE_INSET;
  for (let i = 0; i < columnCount; i++) {
    columnStart.push(cursor);
    cursor += columnWidth[i]! + services.gaps.layer;
  }
  const laneLength = Math.max(
    LANE_MIN_LENGTH,
    columnCount > 0 ? cursor - services.gaps.layer + LANE_INSET : LANE_HEADER + 2 * LANE_INSET,
  );

  // Stacks per lane and column, in ELK's in-layer order.
  const stacks = new Map<string, string[]>();
  for (const id of stepIds) {
    const key = `${reading.laneOf.get(id)}|${layerOf(id)}`;
    stacks.set(key, [...(stacks.get(key) ?? []), id]);
  }
  for (const list of stacks.values()) {
    list.sort((a, b) => (order[a]?.order ?? 0) - (order[b]?.order ?? 0) || a.localeCompare(b));
  }
  const stackDepth = (list: string[]) =>
    list.reduce((sum, id) => sum + across(id), 0) + services.gaps.node * (list.length - 1);

  const layouts: KindArrangement["layouts"] = [];
  // The bands start where the lanes already start, whichever lane comes first now.
  const placed = reading.lanes.map((lane) => nodeLayouts[lane.id]).filter((l) => l !== undefined);
  const origin = {
    x: placed.length > 0 ? Math.min(...placed.map((l) => l.x)) : 0,
    y: placed.length > 0 ? Math.min(...placed.map((l) => l.y)) : 0,
  };
  let laneCursor = 0;
  for (const lane of reading.lanes) {
    let deepest = 0;
    for (let column = 0; column < columnCount; column++) {
      const list = stacks.get(`${lane.id}|${column}`);
      if (list) deepest = Math.max(deepest, stackDepth(list));
    }
    const depth = Math.max(LANE_MIN_DEPTH, deepest + 2 * LANE_PADDING);
    const laneAlong = 0;
    const laneAcross = laneCursor;
    layouts.push(
      vertical
        ? {
            elementId: lane.id,
            x: origin.x + laneAcross,
            y: origin.y + laneAlong,
            width: depth,
            height: laneLength,
          }
        : {
            elementId: lane.id,
            x: origin.x + laneAlong,
            y: origin.y + laneAcross,
            width: laneLength,
            height: depth,
          },
    );

    for (let column = 0; column < columnCount; column++) {
      const list = stacks.get(`${lane.id}|${column}`);
      if (!list) continue;
      let offset = depth / 2 - stackDepth(list) / 2;
      for (const id of list) {
        const a = columnStart[column]! + (columnWidth[column]! - along(id)) / 2;
        const size = sizeOf(id);
        layouts.push(
          vertical
            ? { elementId: id, x: offset, y: a, width: size.width, height: size.height }
            : { elementId: id, x: a, y: offset, width: size.width, height: size.height },
        );
        offset += across(id) + services.gaps.node;
      }
    }
    laneCursor += depth;
  }
  return { layouts: layouts.map(round) };
}

/**
 * Longest-path layers and discovery order. The walk starts at the start step,
 * then at any step it did not reach, in their current order along the axis
 * (so a step not yet connected stays roughly where it is drawn). An edge to a
 * step on the walk's current path is a back-edge and does not layer.
 */
function layerSteps(
  reading: GuidedReading,
  alongOf: (id: string) => number,
): { layer: Map<string, number>; order: Map<string, number> } {
  const order = new Map<string, number>();
  const forward = new Map<string, string[]>();
  const onPath = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    visited.add(id);
    onPath.add(id);
    order.set(id, order.size);
    for (const exit of reading.outgoing.get(id) ?? []) {
      if (onPath.has(exit.targetId)) continue; // a retry
      forward.set(id, [...(forward.get(id) ?? []), exit.targetId]);
      if (!visited.has(exit.targetId)) visit(exit.targetId);
    }
    onPath.delete(id);
  };
  const roots = [
    ...reading.starts.map((s) => s.id),
    ...[...reading.steps.keys()].sort((a, b) => alongOf(a) - alongOf(b) || a.localeCompare(b)),
  ];
  for (const root of roots) if (!visited.has(root)) visit(root);

  // Longest path over the forward edges (a DAG), by repeated relaxation in discovery order.
  const layer = new Map<string, number>([...reading.steps.keys()].map((id) => [id, 0]));
  const byOrder = [...order.keys()].sort((a, b) => order.get(a)! - order.get(b)!);
  const indegree = new Map<string, number>(byOrder.map((id) => [id, 0]));
  for (const targets of forward.values())
    for (const t of targets) indegree.set(t, (indegree.get(t) ?? 0) + 1);
  const queue = byOrder.filter((id) => indegree.get(id) === 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const target of forward.get(id) ?? []) {
      layer.set(target, Math.max(layer.get(target)!, layer.get(id)! + 1));
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  return { layer, order };
}

function round<T extends { x: number; y: number }>(layout: T): T {
  return { ...layout, x: Math.round(layout.x), y: Math.round(layout.y) };
}

/** The order of lanes across the axis: a reorder re-arranges like a structural edit. */
export function guidedArrangeKey(diagram: DiagramModel): string {
  const reading = readGuided(diagram);
  return `${diagram.direction ?? "LR"}:${reading.lanes.map((lane) => lane.id).join(",")}`;
}
