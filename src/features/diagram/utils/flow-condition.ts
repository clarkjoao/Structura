import type { Flow, FlowBranch, FlowStep } from "../model/flow.types";
import { checkFlowInvariants, getReachableStepIds } from "./flow-graph";
import { copySteps, refuse, settle, type FlowEditRefusal, type FlowEditResult } from "./flow-edit";

/**
 * Every operation here is defined on a graph that already holds the four
 * structural invariants, so a broken flow is refused rather than edited into
 * something worse.
 */
function rejectBrokenInput(flow: Flow): FlowEditRefusal | null {
  const violations = checkFlowInvariants(flow);
  if (violations.length === 0) return null;
  return refuse(
    "invalid_input",
    `flow "${flow.id}" does not hold the structural invariants; repair it before editing`,
    violations,
  );
}

/** A branch to create, with the id of the placeholder step that will hold it open. */
export interface NewBranchSpec {
  label: string;
  stepId: string;
}

function branchSpecProblem(flow: Flow, branches: readonly NewBranchSpec[]): string | null {
  if (branches.length === 0) return "a condition needs at least one branch";
  const seen = new Set<string>();
  for (const branch of branches) {
    if (flow.steps[branch.stepId]) return `step "${branch.stepId}" is already a step of this flow`;
    if (seen.has(branch.stepId)) return `step id "${branch.stepId}" was given twice`;
    seen.add(branch.stepId);
  }
  return null;
}

/**
 * Turns an action step into a condition.
 *
 * Every branch gets a real placeholder step, so a branch is never a dangling
 * reference and the numbering can see it. Whatever followed the step keeps
 * following it: each placeholder points at the old successor, which makes the
 * rest of the flow the place where the branches meet again rather than
 * something the conversion threw away.
 */
export function convertFlowStepToCondition(
  flow: Flow,
  stepId: string,
  conditionLabel: string,
  branches: readonly NewBranchSpec[],
): FlowEditResult {
  const broken = rejectBrokenInput(flow);
  if (broken) return broken;

  const step = flow.steps[stepId];
  if (!step) return refuse("unknown_step", `step "${stepId}" is not a step of this flow`);
  if (step.branches && step.branches.length > 0) {
    return refuse("unknown_step", `step "${stepId}" is already a condition`);
  }

  const problem = branchSpecProblem(flow, branches);
  if (problem) return refuse("invalid_branch_index", problem);

  const steps = copySteps(flow);
  const successor = step.next;

  const condition: FlowStep = { ...step, type: "condition", conditionLabel };
  delete condition.next;
  condition.branches = branches.map(({ label, stepId: branchStepId }) => ({
    label,
    nextId: branchStepId,
  }));
  steps[stepId] = condition;

  for (const branch of branches) {
    const placeholder: FlowStep = { id: branch.stepId, type: "action" };
    if (successor !== undefined) placeholder.next = successor;
    steps[branch.stepId] = placeholder;
  }

  return settle(flow, steps, flow.entryStepId, [], `converting "${stepId}" to a condition`);
}

/**
 * Adds a branch to an existing condition. The new branch starts on a
 * placeholder and ends there: nothing is assumed about where it should rejoin
 * the sequence the other branches came back to.
 */
export function appendFlowBranch(
  flow: Flow,
  conditionStepId: string,
  label: string,
  newStepId: string,
): FlowEditResult {
  const broken = rejectBrokenInput(flow);
  if (broken) return broken;

  const condition = flow.steps[conditionStepId];
  if (!condition) {
    return refuse("unknown_condition", `step "${conditionStepId}" is not a step of this flow`);
  }
  if (!condition.branches || condition.branches.length === 0) {
    return refuse("unknown_condition", `step "${conditionStepId}" is not a condition`);
  }
  const problem = branchSpecProblem(flow, [{ label, stepId: newStepId }]);
  if (problem) return refuse("invalid_branch_index", problem);

  const steps = copySteps(flow);
  steps[conditionStepId] = {
    ...condition,
    branches: [...condition.branches, { label, nextId: newStepId }],
  };
  steps[newStepId] = { id: newStepId, type: "action" };

  return settle(flow, steps, flow.entryStepId, [], `adding a branch to "${conditionStepId}"`);
}

/**
 * Removes one branch of a condition, and with it every step that branch was
 * the only way to reach. Steps the other branches also reach stay.
 *
 * Removing the last branch turns the step back into an action: an empty
 * `branches` array would read as a dead end, which is why `sewOnDelete`
 * already deletes one rather than keeping it.
 */
export function dropFlowBranch(
  flow: Flow,
  conditionStepId: string,
  branchIndex: number,
): FlowEditResult {
  const broken = rejectBrokenInput(flow);
  if (broken) return broken;

  const condition = flow.steps[conditionStepId];
  if (!condition) {
    return refuse("unknown_condition", `step "${conditionStepId}" is not a step of this flow`);
  }
  if (!condition.branches || branchIndex < 0 || branchIndex >= condition.branches.length) {
    return refuse(
      "invalid_branch_index",
      `step "${conditionStepId}" has no branch at index ${branchIndex}`,
    );
  }

  const steps = copySteps(flow);
  const kept: FlowBranch[] = condition.branches.filter((_, index) => index !== branchIndex);
  const trimmed: FlowStep = { ...condition };
  if (kept.length > 0) {
    trimmed.branches = kept;
  } else {
    delete trimmed.branches;
    trimmed.type = "action";
    delete trimmed.conditionLabel;
    delete trimmed.conditionKind;
  }
  steps[conditionStepId] = trimmed;

  const reachable = new Set(getReachableStepIds({ ...flow, steps }));
  const removedStepIds = Object.keys(steps).filter((id) => !reachable.has(id));
  for (const id of removedStepIds) delete steps[id];

  return settle(
    flow,
    steps,
    flow.entryStepId,
    removedStepIds,
    `removing branch ${branchIndex} of "${conditionStepId}"`,
  );
}
