import type { Flow, FlowStep } from "../model/flow.types";
import type { Diagram } from "../model/diagram.types";
import { resolveSceneSnapshot } from "./scene.utils";

export function getStepById(flow: Flow, id: string): FlowStep | undefined {
  return flow.steps[id];
}

export function getNextSteps(flow: Flow, stepId: string): FlowStep[] {
  const step = flow.steps[stepId];
  if (!step) return [];

  if (step.branches && step.branches.length > 0) {
    return step.branches
      .map((b) => flow.steps[b.nextId])
      .filter((s): s is FlowStep => !!s);
  }

  if (step.next) {
    const next = flow.steps[step.next];
    return next ? [next] : [];
  }

  return [];
}

export function isConditionStep(step: FlowStep): boolean {
  return step.type === 'condition' && !!step.branches && step.branches.length > 0;
}

export function getEntryStep(flow: Flow): FlowStep | undefined {
  if (flow.entryStepId) return flow.steps[flow.entryStepId];
  return undefined;
}

export function walkFlow(flow: Flow, visitor: (step: FlowStep) => void): void {
  const entry = getEntryStep(flow);
  if (!entry) return;

  const visited = new Set<string>();
  const stack: FlowStep[] = [entry];

  while (stack.length > 0) {
    const step = stack.pop()!;
    if (visited.has(step.id)) continue;
    visited.add(step.id);
    visitor(step);

    const nexts = getNextSteps(flow, step.id);
    for (let i = nexts.length - 1; i >= 0; i--) {
      if (!visited.has(nexts[i].id)) stack.push(nexts[i]);
    }
  }
}

export function getFlowParticipants(flow: Flow): {
  componentIds: Set<string>;
  connectionIds: Set<string>;
} {
  const componentIds = new Set<string>();
  const connectionIds = new Set<string>();

  walkFlow(flow, (step) => {
    if (step.componentId) componentIds.add(step.componentId);
    if (step.connectionId) connectionIds.add(step.connectionId);
  });

  return { componentIds, connectionIds };
}

export interface BrokenStep {
  stepId: string;
  reason: "component_deleted" | "connection_deleted";
  missingId: string;
  label: string;
}

export function validateFlowGraph(flow: Flow, diagram: Diagram): BrokenStep[] {
  const broken: BrokenStep[] = [];
  const { components, connections } = resolveSceneSnapshot(
    diagram,
    diagram.activeSceneId ?? null,
  );

  walkFlow(flow, (step) => {
    if (step.componentId && !components[step.componentId]) {
      broken.push({
        stepId: step.id,
        reason: "component_deleted",
        missingId: step.componentId,
        label: `Step ${step.id.slice(0, 8)}… — component removed (${step.componentId.slice(0, 8)}…)`,
      });
    }
    if (step.connectionId && !connections[step.connectionId]) {
      broken.push({
        stepId: step.id,
        reason: "connection_deleted",
        missingId: step.connectionId,
        label: `Step ${step.id.slice(0, 8)}… — connection removed (${step.connectionId.slice(0, 8)}…)`,
      });
    }
  });

  return broken;
}


export function getOrderedStepIds(flow: Flow): string[] {
  const ids: string[] = [];
  walkFlow(flow, (step) => ids.push(step.id));
  return ids;
}


export function getStepCount(flow: Flow): number {
  let count = 0;
  walkFlow(flow, () => count++);
  return count;
}


export function getBranchStepCount(flow: Flow, fromStepId: string): number {
  let count = 0;
  const visited = new Set<string>();
  const walk = (id: string) => {
    if (!id || visited.has(id)) return;
    const step = flow.steps[id];
    if (!step) return;
    visited.add(id);
    count++;
    if (step.next) walk(step.next);
    step.branches?.forEach((b) => walk(b.nextId));
  };
  walk(fromStepId);
  return count;
}
