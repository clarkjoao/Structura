import type { Flow, FlowStep } from "../model/flow.types";

/**
 * Remove steps inválidos de um flow e reconstrói as ligações
 * (next/branches) para eliminar referências órfãs.
 * Retorna o novo Record<string, FlowStep> e o entryStepId corrigido.
 */
export function repairFlow(
  flow: Flow,
  stepIdsToRemove: string[] = [],
): { steps: Record<string, FlowStep>; entryStepId: string | undefined } {
  const idSet = new Set(stepIdsToRemove);

  const steps: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(flow.steps)) {
    if (idSet.has(id)) continue;
    steps[id] = { ...step };
  }

  for (const id of Object.keys(steps)) {
    const step = steps[id]!;
    const nextStep: FlowStep = { ...step };
    const resolvedNext = step.next && steps[step.next] ? step.next : undefined;
    if (resolvedNext !== undefined) {
      nextStep.next = resolvedNext;
    } else {
      delete nextStep.next;
    }

    const hadBranches = step.branches !== undefined;
    if (hadBranches) {
      const filteredBranches = step.branches!.filter((branch) => steps[branch.nextId]);
      if (filteredBranches.length > 0) {
        nextStep.branches = filteredBranches;
      } else {
        delete nextStep.branches;
      }
    }

    steps[id] = nextStep;
  }

  let entryStepId = flow.entryStepId;
  if (entryStepId && idSet.has(entryStepId)) {
    entryStepId = Object.keys(steps)[0];
  } else if (entryStepId && !steps[entryStepId]) {
    entryStepId = undefined;
  }

  return { steps, entryStepId };
}
