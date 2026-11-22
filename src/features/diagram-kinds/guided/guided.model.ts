import type {
  Component,
  FlowNodeShape,
  PanelComponent,
  ProcessNodeComponent,
} from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import {
  isPanelComponent,
  isProcessNodeComponent,
} from "@/features/diagram/model/component.guards";
import { isTextType } from "@/features/diagram/model/component-type-constants";
import { COMPONENT_TYPE_NOTE } from "@/features/diagram/model/component-type-constants";
import { PanelKind } from "@/features/diagram/enums";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";

/**
 * How the guided kind reads an ordinary diagram (design D5): lanes are
 * top-level swimlane panels, steps are flowchart shapes inside a lane, the
 * sequence is the connections between steps. Nothing is stored beyond the
 * derived flow's id, so this reading is all there is — which is what lets a
 * diagram edited freehand come back.
 */

export const GUIDED_KIND_ID = "guided";

/** The kind data key holding the lanes' order: ids, first lane first. */
export const GUIDED_LANE_ORDER_KEY = "laneOrder";

/** The stored lane order, when the kind data holds one. */
export function guidedLaneOrder(diagram: Pick<DiagramModel, "kindData">): readonly string[] {
  const value = diagram.kindData?.[GUIDED_LANE_ORDER_KEY];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/**
 * Lanes in their order. The stored order is the truth: an arrangement, an
 * Arrange run while edited freehand, a drag or a peer's move cannot reorder
 * lanes, only the lane gestures can. A lane the order does not name yet (just
 * added, or drawn freehand) takes its place by position among the others.
 */
function orderLanes(byPosition: GuidedLane[], stored: readonly string[]): GuidedLane[] {
  const rank = new Map(stored.map((id, index) => [id, index]));
  const known = byPosition
    .filter((lane) => rank.has(lane.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  let next = 0;
  // The slots the known lanes hold by position are refilled in the stored order.
  return byPosition.map((lane) => (rank.has(lane.id) ? known[next++]! : lane));
}

/** The journey step shapes, in palette order. */
export const GUIDED_STEP_SHAPES = [
  "rectangle",
  "diamond",
  "end",
  "start",
  "event",
  "subroutine",
  "cylinder",
  "document",
] as const satisfies readonly FlowNodeShape[];

const STEP_SHAPES: ReadonlySet<string> = new Set(GUIDED_STEP_SHAPES);

export type GuidedLane = PanelComponent;
export type GuidedStep = ProcessNodeComponent;

export function isGuidedLane(component: Component): component is GuidedLane {
  return isPanelComponent(component) && component.panelKind === PanelKind.Swimlane;
}

export function isGuidedStep(component: Component): component is GuidedStep {
  return isProcessNodeComponent(component) && STEP_SHAPES.has(component.flowShape);
}

export function isGuidedDecision(component: Component): boolean {
  return isProcessNodeComponent(component) && component.flowShape === "diamond";
}

export function isGuidedStart(component: Component): boolean {
  return isProcessNodeComponent(component) && component.flowShape === "start";
}

export function isGuidedEnd(component: Component): boolean {
  return isProcessNodeComponent(component) && component.flowShape === "end";
}

/** A step's experience score (spec guided-journey-experience): 1–5, or null. */
export function experienceOf(component: Component): number | null {
  const value = component.kindProps?.experience;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
}

/** Scores 1–2: where the journey hurts. */
export const isPainPoint = (score: number | null): boolean => score !== null && score <= 2;

/** The face shown for a score. */
export const EXPERIENCE_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;

/** Free text and notes: allowed anywhere, ignored by the guided rules. */
export function isGuidedAnnotation(component: Component): boolean {
  return isTextType(component.type) || component.type === COMPONENT_TYPE_NOTE;
}

export interface GuidedReading {
  /**
   * Lanes in reading order across the axis: top to bottom (LR), left to right (TB) — the
   * stored lane order, with lanes it does not name yet placed by position.
   */
  lanes: GuidedLane[];
  /** Steps that sit in a lane, by id. */
  steps: Map<string, GuidedStep>;
  laneOf: Map<string, string>;
  /** Outgoing step-to-step connections per step, in a stable order. */
  outgoing: Map<string, Connection[]>;
  incoming: Map<string, Connection[]>;
  /** The start steps found (a conforming diagram has exactly one). */
  starts: GuidedStep[];
  components: Record<string, Component>;
  connections: Record<string, Connection>;
}

/** Reads lanes, steps and sequence from the diagram as the canvas shows it (Version applied). */
export function readGuided(diagram: DiagramModel): GuidedReading {
  const resolved = getCachedCanvasSnapshot(diagram);
  const { components, connections, nodeLayouts } = resolved;
  const vertical = diagram.direction === "TB";

  const lanesByPosition = Object.values(components)
    .filter((c): c is GuidedLane => isGuidedLane(c) && c.parentId === null)
    .sort((a, b) => {
      const la = nodeLayouts[a.id];
      const lb = nodeLayouts[b.id];
      const pa = vertical ? (la?.x ?? 0) : (la?.y ?? 0);
      const pb = vertical ? (lb?.x ?? 0) : (lb?.y ?? 0);
      // The other axis breaks ties, so lanes stacked for one direction keep their order when the
      // diagram is read on the other (a direction switch arranges before the bands turn).
      const qa = vertical ? (la?.y ?? 0) : (la?.x ?? 0);
      const qb = vertical ? (lb?.y ?? 0) : (lb?.x ?? 0);
      return pa - pb || qa - qb || a.id.localeCompare(b.id);
    });
  const lanes = orderLanes(lanesByPosition, guidedLaneOrder(diagram));
  const laneIds = new Set(lanes.map((lane) => lane.id));

  const steps = new Map<string, GuidedStep>();
  const laneOf = new Map<string, string>();
  for (const component of Object.values(components)) {
    if (!isGuidedStep(component)) continue;
    if (component.parentId === null || !laneIds.has(component.parentId)) continue;
    steps.set(component.id, component);
    laneOf.set(component.id, component.parentId);
  }

  const outgoing = new Map<string, Connection[]>();
  const incoming = new Map<string, Connection[]>();
  for (const connection of Object.values(connections).sort((a, b) => a.id.localeCompare(b.id))) {
    if (!steps.has(connection.sourceId) || !steps.has(connection.targetId)) continue;
    outgoing.set(connection.sourceId, [...(outgoing.get(connection.sourceId) ?? []), connection]);
    incoming.set(connection.targetId, [...(incoming.get(connection.targetId) ?? []), connection]);
  }
  // Exits in reading order of their targets, so "first exit" is stable and visible.
  const position = (id: string) => {
    const layout = nodeLayouts[id];
    return vertical ? (layout?.x ?? 0) : (layout?.y ?? 0);
  };
  for (const [id, list] of outgoing) {
    outgoing.set(
      id,
      [...list].sort(
        (a, b) =>
          lanes.findIndex((l) => l.id === laneOf.get(a.targetId)) -
            lanes.findIndex((l) => l.id === laneOf.get(b.targetId)) ||
          position(a.targetId) - position(b.targetId) ||
          a.id.localeCompare(b.id),
      ),
    );
  }

  const starts = [...steps.values()].filter(isGuidedStart).sort((a, b) => a.id.localeCompare(b.id));
  return { lanes, steps, laneOf, outgoing, incoming, starts, components, connections };
}

/** The lane after (`+1`) or before (`-1`) a lane, or null at the edge. */
export function neighbourLane(
  reading: GuidedReading,
  laneId: string,
  offset: 1 | -1,
): GuidedLane | null {
  const index = reading.lanes.findIndex((lane) => lane.id === laneId);
  if (index < 0) return null;
  return reading.lanes[index + offset] ?? null;
}

/** Steps in reading order: depth-first from the start along each exit, then the rest. */
export function readingOrder(reading: GuidedReading): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    for (const exit of reading.outgoing.get(id) ?? []) visit(exit.targetId);
  };
  for (const start of reading.starts) visit(start.id);
  for (const id of reading.steps.keys()) visit(id);
  return order;
}

/**
 * The step graph without its back-edges, in discovery order. The walk starts
 * at the start step, then at any step it did not reach, in their current order
 * along the axis (so a step not yet connected stays roughly where it is drawn).
 * An edge to a step on the walk's current path is a back-edge (a retry).
 * `topo` is a topological order of the forward edges (Kahn, discovery order).
 */
export function forwardGraph(
  reading: GuidedReading,
  alongOf: (id: string) => number = () => 0,
): { forward: Map<string, string[]>; order: Map<string, number>; topo: string[] } {
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

  const byOrder = [...order.keys()].sort((a, b) => order.get(a)! - order.get(b)!);
  const indegree = new Map<string, number>(byOrder.map((id) => [id, 0]));
  for (const targets of forward.values())
    for (const t of targets) indegree.set(t, (indegree.get(t) ?? 0) + 1);
  const queue = byOrder.filter((id) => indegree.get(id) === 0);
  const topo: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    topo.push(id);
    for (const target of forward.get(id) ?? []) {
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  return { forward, order, topo };
}
