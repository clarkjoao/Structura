import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindArrangement, KindContext, KindLayoutServices } from "../kind.types";
import { type GuidedReading, forwardGraph, readGuided } from "./guided.model";
import { guidedPhases, phaseStartOf } from "./guided.phases";
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
 * Longest-path layers over the forward edges, with phase floors (spec
 * guided-journey-phases): a phase's steps come after every column of the
 * phases before it. Floors depend on layers and layers on floors, so it
 * relaxes until nothing moves (floors only grow; a few passes in practice).
 */
function layerSteps(
  reading: GuidedReading,
  alongOf: (id: string) => number,
): { layer: Map<string, number>; order: Map<string, number> } {
  const { forward, order, topo } = forwardGraph(reading, alongOf);
  const { phaseOf, phases } = guidedPhases(reading, { forward, topo });
  // Steps before the first phase start are group -1; group p's floor follows all groups before it.
  const groupOf = (id: string) => phaseOf.get(id) ?? -1;
  const floors = new Map<number, number>();
  let layer = new Map<string, number>();
  for (let pass = 0; pass <= phases.length + 1; pass++) {
    layer = new Map([...reading.steps.keys()].map((id) => [id, floors.get(groupOf(id)) ?? 0]));
    for (const id of topo) {
      for (const target of forward.get(id) ?? [])
        layer.set(target, Math.max(layer.get(target)!, layer.get(id)! + 1));
    }
    if (phases.length === 0) break;
    let changed = false;
    let ceiling = -1;
    for (let group = -1; group < phases.length; group++) {
      if (group >= 0 && ceiling >= 0) {
        const floor = ceiling + 1;
        if ((floors.get(group) ?? 0) < floor) {
          floors.set(group, floor);
          changed = true;
        }
      }
      for (const [id, value] of layer)
        if (groupOf(id) === group) ceiling = Math.max(ceiling, value);
    }
    if (!changed) break;
  }
  return { layer, order };
}

function round<T extends { x: number; y: number }>(layout: T): T {
  return { ...layout, x: Math.round(layout.x), y: Math.round(layout.y) };
}

/** The order of lanes across the axis: a reorder re-arranges like a structural edit. */
export function guidedArrangeKey(diagram: DiagramModel): string {
  const reading = readGuided(diagram);
  // Phase starts move columns (spec guided-journey-phases).
  const starts = [...reading.steps.values()]
    .flatMap((step) => {
      const phase = phaseStartOf(step);
      return phase ? [`${step.id}=${phase}`] : [];
    })
    .sort();
  return `${diagram.direction ?? "LR"}:${reading.lanes.map((lane) => lane.id).join(",")}|${starts.join(",")}`;
}
