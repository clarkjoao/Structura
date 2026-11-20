import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { Flow, FlowStep } from "@/features/diagram/model/flow.types";
import type { KindEdit } from "@/features/diagram/model/kind-edit.types";
import { stepsToMermaid } from "@/features/diagram/utils/flow-mermaid";
import type { KindContext } from "../kind.types";
import { isGuidedDecision, readGuided } from "./guided.model";

/** The kind data key holding the derived flow's id. */
const GUIDED_FLOW_ID_KEY = "flowId";

/** The derived flow's id, when the kind data names one. */
export function guidedFlowId(diagram: Pick<DiagramModel, "kindData">): string | undefined {
  const value = diagram.kindData?.[GUIDED_FLOW_ID_KEY];
  return typeof value === "string" ? value : undefined;
}

/** Topology fields, rewritten on every derivation; everything else on a step is content. */
type Topology = "id" | "type" | "next" | "branches" | "componentId";

function content(step: FlowStep | undefined): Omit<FlowStep, Topology> {
  if (!step) return {};
  const { id: _id, type: _type, next: _next, branches: _branches, componentId: _c, ...rest } = step;
  return rest;
}

/**
 * The flow a guided diagram's steps already are (spec guided-flow-derivation).
 *
 * Walks from the start step along the connections, depth first in exit order.
 * A connection back to a step on the current path (a retry) stays on the
 * canvas but not in the flow — flows have no cycles. A step reached twice (two
 * branches joining) is one flow step. Steps the start cannot reach are not in
 * the flow. Content written on a flow step (description, payload, state, …)
 * is kept by the step it points at; only the topology is rewritten.
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
  for (const step of Object.values(previous?.steps ?? {})) {
    if (step.componentId && !previousByComponent.has(step.componentId)) {
      previousByComponent.set(step.componentId, step);
    }
  }
  const stepIdOf = new Map<string, string>();
  const stepId = (componentId: string): string => {
    let id = stepIdOf.get(componentId);
    if (!id) {
      id = previousByComponent.get(componentId)?.id ?? ctx.newId("step");
      stepIdOf.set(componentId, id);
    }
    return id;
  };

  const steps: Record<string, FlowStep> = {};
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
              nextId: stepId(exit.targetId),
            })),
            ...(kept.conditionLabel === undefined && { conditionLabel: component.name }),
          }
        : exits[0]
          ? { next: stepId(exits[0].targetId) }
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
  const sameData = existingId === flowId;
  // A lane renamed in the inspector: its header label follows the name.
  const renamedLanes = reading.lanes
    .filter((lane) => lane.swimlane && lane.swimlane.laneLabel !== lane.name)
    .map((lane) => ({ id: lane.id, name: lane.name }));
  if (sameFlow && sameData && renamedLanes.length === 0) return null;
  return {
    ...(renamedLanes.length > 0 && { update: renamedLanes }),
    ...(!sameFlow && { flows: { set: [flow] } }),
    ...(!sameData && { kindData: { ...(diagram.kindData ?? {}), [GUIDED_FLOW_ID_KEY]: flowId } }),
  };
}
