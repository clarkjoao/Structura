import type { Flow, FlowStep } from "../model/flow.types";
import { isFlowLinkStep } from "../model/flow.types";
import { isConditionStep } from "./flow-traversal";

/**
 * Remove steps inválidos de um flow e reconstrói as ligações
 * (next/branches) para eliminar referências órfãs.
 * Retorna o novo Record<string, FlowStep> e o entryStepId corrigido.
 */
export function repairFlow(
  flow: Flow,
  stepIdsToRemove: string[],
): { steps: Record<string, FlowStep>; entryStepId: string | undefined } {
  const idSet = new Set(stepIdsToRemove);

  // 1. Filter out removed steps
  const steps: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(flow.steps)) {
    if (idSet.has(id)) continue;
    if (isFlowLinkStep(step)) {
      steps[id] = { ...step };
      continue;
    }
    if (isConditionStep(step)) {
      steps[id] = {
        ...step,
        next: step.next && idSet.has(step.next) ? undefined : step.next,
        branches: step.branches.filter((b) => !idSet.has(b.nextId)),
      };
      continue;
    }
    steps[id] = {
      ...step,
      next: step.next && idSet.has(step.next) ? undefined : step.next,
    };
  }

  // 2. Recalculate entryStepId if removed
  let entryStepId = flow.entryStepId;
  if (entryStepId && idSet.has(entryStepId)) {
    entryStepId = Object.keys(steps)[0];
  }

  return { steps, entryStepId };
}
