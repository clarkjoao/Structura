import type { Flow, FlowStep } from "../model/flow.types";

/**
 * A requested removal that was not carried out, because the rule for it is
 * not settled. The step is left in place rather than resolved by guesswork.
 */
export interface SewBlockedStep {
  code: "branch_point";
  stepId: string;
  branchTargetIds: string[];
  detail: string;
}

export interface SewOnDeleteResult {
  steps: Record<string, FlowStep>;
  entryStepId: string | undefined;
  /** Steps actually removed, in the order they were requested. */
  removedStepIds: string[];
  blocked: SewBlockedStep[];
}

/**
 * Removes steps from a flow and sews the graph back together: every reference
 * to a removed step is redirected to that step's successor, so a chain stays
 * continuous instead of being severed at the hole.
 *
 * - A step in the middle: its predecessor points at its successor.
 * - The entry step: its successor becomes the entry. With no successor, the
 *   entry falls back to the first remaining step, as it did before.
 * - The last step: its predecessor simply loses its `next`.
 * - A branch point (a step with a non-empty `branches` array): **not removed**.
 *   What should become of the orphaned branches is a product decision, so the
 *   step is kept and reported in `blocked`; the existing broken-step check
 *   surfaces it to the user rather than this function inventing an answer.
 *
 * References to ids that are absent from the record are dropped, and a branch
 * array left empty is removed entirely — both as before.
 */
export function sewOnDelete(flow: Flow, stepIdsToRemove: readonly string[]): SewOnDeleteResult {
  const blocked: SewBlockedStep[] = [];
  const removing = new Set<string>();

  for (const id of stepIdsToRemove) {
    const step = flow.steps[id];
    if (!step) continue;
    if (step.branches && step.branches.length > 0) {
      blocked.push({
        code: "branch_point",
        stepId: id,
        branchTargetIds: step.branches.map((branch) => branch.nextId),
        detail: `step "${id}" is a branch point; removing it would orphan ${step.branches.length} branch(es)`,
      });
      continue;
    }
    removing.add(id);
  }

  /**
   * First surviving step at or after `target`, following `next` through the
   * removed run. Returns undefined for a dangling id, for a run that ends
   * without a survivor, and for a cycle made only of removed steps.
   */
  const redirect = (target: string | undefined): string | undefined => {
    const seen = new Set<string>();
    let cursor = target;
    while (cursor !== undefined) {
      if (seen.has(cursor)) return undefined;
      seen.add(cursor);
      const step = flow.steps[cursor];
      if (!step) return undefined;
      if (!removing.has(cursor)) return cursor;
      cursor = step.next;
    }
    return undefined;
  };

  const steps: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(flow.steps)) {
    if (removing.has(id)) continue;

    const sewn: FlowStep = { ...step };

    const nextId = redirect(step.next);
    if (nextId !== undefined) sewn.next = nextId;
    else delete sewn.next;

    if (step.branches !== undefined) {
      const branches = step.branches
        .map((branch) => ({ ...branch, nextId: redirect(branch.nextId) }))
        .filter(
          (branch): branch is { label: string; nextId: string } => branch.nextId !== undefined,
        );
      if (branches.length > 0) sewn.branches = branches;
      else delete sewn.branches;
    }

    steps[id] = sewn;
  }

  let entryStepId = flow.entryStepId;
  if (entryStepId !== undefined) {
    if (removing.has(entryStepId)) {
      entryStepId = redirect(entryStepId) ?? Object.keys(steps)[0];
    } else if (!steps[entryStepId]) {
      entryStepId = undefined;
    }
  }

  return {
    steps,
    entryStepId,
    removedStepIds: [...removing],
    blocked,
  };
}
