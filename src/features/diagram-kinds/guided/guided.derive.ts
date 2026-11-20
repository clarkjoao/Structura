import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import type { Flow, FlowStep } from "@/features/diagram/model/flow.types";
import type { KindEdit } from "@/features/diagram/model/kind-edit.types";
import { stepsToMermaid } from "@/features/diagram/utils/flow-mermaid";
import type { KindContext } from "../kind.types";
import {
  GUIDED_LANE_ORDER_KEY,
  guidedLaneOrder,
  isGuidedDecision,
  readGuided,
} from "./guided.model";

/** The kind data key holding the derived flow's id. */
const GUIDED_FLOW_ID_KEY = "flowId";

/** The derived flow's id, when the kind data names one. */
export function guidedFlowId(diagram: Pick<DiagramModel, "kindData">): string | undefined {
  const value = diagram.kindData?.[GUIDED_FLOW_ID_KEY];
  return typeof value === "string" ? value : undefined;
}

/** Topology fields, rewritten on every derivation; everything else on a step is content. */
type Topology = "id" | "type" | "next" | "branches" | "componentId" | "connectionId";

function content(step: FlowStep | undefined): Omit<FlowStep, Topology> {
  if (!step) return {};
  const {
    id: _id,
    type: _type,
    next: _next,
    branches: _branches,
    componentId: _component,
    connectionId: _connection,
    ...rest
  } = step;
  return rest;
}

/**
 * The flow a guided diagram's steps already are (spec guided-flow-derivation).
 *
 * Walks from the start step along the connections, depth first in exit order.
 * It reads the way a recording does: a step at each journey step, and between
 * two of them a step on the connection travelled, so playing it back lights
 * the line as well as the boxes.
 * A connection back to a step on the current path (a retry) stays on the
 * canvas but not in the flow — flows have no cycles. A step reached twice (two
 * branches joining) is one flow step. Steps the start cannot reach are not in
 * the flow. Content written on a flow step (description, payload, state, …)
 * is kept by the step or connection it points at; only the topology is
 * rewritten.
 *
 * Returns null when the stored flow already is the derivation.
 */
export function deriveGuidedFlow(diagram: DiagramModel, ctx: KindContext): KindEdit | null {
  const reading = readGuided(diagram);
  const start = reading.starts[0];
  const existingId = guidedFlowId(diagram);
  const previous = existingId ? diagram.snapshot.flows[existingId] : undefined;
  const flowId = previous?.id ?? existingId ?? ctx.newId("flow");

  const previousByComponent = new Map<string, FlowStep>();
  const previousByConnection = new Map<string, FlowStep>();
  for (const step of Object.values(previous?.steps ?? {})) {
    if (step.componentId && !previousByComponent.has(step.componentId)) {
      previousByComponent.set(step.componentId, step);
    } else if (
      !step.componentId &&
      step.connectionId &&
      !previousByConnection.has(step.connectionId)
    ) {
      previousByConnection.set(step.connectionId, step);
    }
  }
  const idOf = (
    ids: Map<string, string>,
    previousBy: Map<string, FlowStep>,
  ): ((key: string) => string) => {
    return (key) => {
      let id = ids.get(key);
      if (!id) {
        id = previousBy.get(key)?.id ?? ctx.newId("step");
        ids.set(key, id);
      }
      return id;
    };
  };
  const stepId = idOf(new Map(), previousByComponent);
  const edgeStepId = idOf(new Map(), previousByConnection);

  const steps: Record<string, FlowStep> = {};
  /** The step on a travelled connection: it carries on to the step it reaches. */
  const travel = (exit: Connection): string => {
    const id = edgeStepId(exit.id);
    steps[id] = {
      ...content(previousByConnection.get(exit.id)),
      id,
      type: "action",
      connectionId: exit.id,
      next: stepId(exit.targetId),
    };
    return id;
  };
  const onPath = new Set<string>();
  const done = new Set<string>();
  const visit = (componentId: string): void => {
    if (done.has(componentId)) return;
    onPath.add(componentId);
    const component = reading.steps.get(componentId)!;
    const exits = (reading.outgoing.get(componentId) ?? []).filter(
      (connection) => !onPath.has(connection.targetId),
    );
    for (const exit of exits) visit(exit.targetId);
    const kept = content(previousByComponent.get(componentId));
    const branching = isGuidedDecision(component) || exits.length > 1;
    const step: FlowStep = {
      ...kept,
      id: stepId(componentId),
      type: branching ? "condition" : "action",
      componentId,
      ...(branching
        ? {
            branches: exits.map((exit) => ({
              label: exit.label ?? "",
              nextId: travel(exit),
            })),
            ...(kept.conditionLabel === undefined && { conditionLabel: component.name }),
          }
        : exits[0]
          ? { next: travel(exits[0]) }
          : {}),
    };
    if (branching && exits.length === 0) delete step.branches;
    steps[step.id] = step;
    onPath.delete(componentId);
    done.add(componentId);
  };
  if (start) visit(start.id);

  const flow: Flow = {
    ...(previous ?? {}),
    id: flowId,
    name: previous?.name ?? diagram.name,
    diagramId: diagram.id,
    steps,
    mermaid: "",
    ...(start ? { entryStepId: stepId(start.id) } : {}),
  };
  if (!start) delete flow.entryStepId;
  flow.mermaid = stepsToMermaid(flow, reading.components, reading.connections);

  const sameFlow = previous !== undefined && JSON.stringify(previous) === JSON.stringify(flow);
  // The lane order names exactly the lanes there are: a new lane joins it where it was put, a
  // removed one leaves it.
  const laneOrder = reading.lanes.map((lane) => lane.id);
  const sameOrder = JSON.stringify(guidedLaneOrder(diagram)) === JSON.stringify(laneOrder);
  const sameData = existingId === flowId && sameOrder;
  // A lane renamed in the inspector: its header label follows the name.
  const renamedLanes = reading.lanes
    .filter((lane) => lane.swimlane && lane.swimlane.laneLabel !== lane.name)
    .map((lane) => ({ id: lane.id, name: lane.name }));
  // Lanes are bands across the reading axis: after a direction switch their headers turn too.
  const orientation = diagram.direction === "TB" ? "vertical" : "horizontal";
  const turnedLanes = reading.lanes
    .filter((lane) => (lane.swimlane?.orientation ?? "horizontal") !== orientation)
    .map((lane) => ({ id: lane.id, orientation }) as const);
  if (sameFlow && sameData && renamedLanes.length === 0 && turnedLanes.length === 0) return null;
  return {
    ...(renamedLanes.length > 0 && { update: renamedLanes }),
    ...(turnedLanes.length > 0 && { laneOrientation: turnedLanes }),
    ...(!sameFlow && { flows: { set: [flow] } }),
    ...(!sameData && {
      kindData: {
        ...(diagram.kindData ?? {}),
        [GUIDED_FLOW_ID_KEY]: flowId,
        [GUIDED_LANE_ORDER_KEY]: laneOrder,
      },
    }),
  };
}
