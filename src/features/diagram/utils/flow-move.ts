import type { Flow, FlowBranch, FlowStep } from "../model/flow.types";
import { checkFlowInvariants, type FlowInvariantViolation } from "./flow-graph";

/**
 * Where a moved step should end up. There is no "after" a branch point: a
 * non-empty `branches` array shadows `next`, so the position after a condition
 * is inside one of its branches — `branchStart` is how you get there.
 */
export type MoveStepTarget =
  | { kind: "before"; stepId: string }
  | { kind: "after"; stepId: string }
  | { kind: "branchStart"; stepId: string; branchIndex: number };

export type MoveStepRefusalCode =
  | "unknown_step"
  | "unknown_target"
  | "self_target"
  | "invalid_branch_index"
  | "invalid_input"
  | "branch_point_move"
  | "target_after_branch_point"
  | "join_broken"
  | "invariant_violated";

export interface MoveStepRefusal {
  ok: false;
  code: MoveStepRefusalCode;
  detail: string;
  violations?: FlowInvariantViolation[];
}

export interface MoveStepSuccess {
  ok: true;
  steps: Record<string, FlowStep>;
  entryStepId: string | undefined;
}

export type MoveStepResult = MoveStepSuccess | MoveStepRefusal;

function refuse(
  code: MoveStepRefusalCode,
  detail: string,
  violations?: FlowInvariantViolation[],
): MoveStepRefusal {
  return violations ? { ok: false, code, detail, violations } : { ok: false, code, detail };
}

/** Every step reachable from `startId`, following `next` and every branch. */
function reachableFrom(flow: Flow, startId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const step = flow.steps[id];
    if (!step) continue;
    if (step.branches && step.branches.length > 0) {
      for (const branch of step.branches) stack.push(branch.nextId);
    } else if (step.next !== undefined) {
      stack.push(step.next);
    }
  }
  return seen;
}

/** How many steps point straight at `id`, by `next` or by a branch. */
function incomingCount(flow: Flow, id: string): number {
  let count = 0;
  for (const step of Object.values(flow.steps)) {
    if (step.next === id) count += 1;
    for (const branch of step.branches ?? []) {
      if (branch.nextId === id) count += 1;
    }
  }
  return count;
}

/**
 * The branch points that feed `id`, and how many of their branches get there.
 *
 * A step is a *join* when two or more branches of the same condition reach it:
 * that is the reconvergence a reader sees when both answers lead back to the
 * same place. One branch reaching it is just a step inside a branch.
 */
function feedingForks(flow: Flow, id: string): Map<string, number> {
  const forks = new Map<string, number>();
  for (const step of Object.values(flow.steps)) {
    if (!step.branches || step.branches.length === 0) continue;
    let count = 0;
    for (const branch of step.branches) {
      if (reachableFrom(flow, branch.nextId).has(id)) count += 1;
    }
    if (count >= 2) forks.set(step.id, count);
  }
  return forks;
}

/**
 * Whether moving a join has undone the reconvergence.
 *
 * Two ways it can, both measured on the graph the move produced:
 *
 * - the join now sits *in front of* the branch point that fed it, so the fork
 *   is reachable from it and no branch can ever arrive;
 * - the join is still reachable from the fork, but from fewer of its branches
 *   than before — it has been pulled inside one branch, and the others no
 *   longer meet there.
 *
 * A join that stops being reachable from the fork entirely without the fork
 * moving behind it is left alone: the branches keep meeting at whatever the
 * join handed its successor to. That case is deliberately not decided here.
 */
function brokenJoinFork(before: Flow, after: Flow, stepId: string): string | null {
  // A join is a step two or more steps point *at*. Without this, everything
  // downstream of a reconvergence counts as one too — both branches reach it,
  // just not directly — and ordinary steps become unmovable.
  if (incomingCount(before, stepId) < 2) return null;
  const forksBefore = feedingForks(before, stepId);
  if (forksBefore.size === 0) return null;
  const aheadOfMoved = reachableFrom(after, stepId);
  for (const [forkId, countBefore] of forksBefore) {
    if (aheadOfMoved.has(forkId)) return forkId;
    const countAfter = branchesReaching(after, forkId, stepId);
    if (countAfter >= 1 && countAfter < countBefore) return forkId;
  }
  return null;
}

/** How many of `forkId`'s branches reach `id` in `flow`. */
function branchesReaching(flow: Flow, forkId: string, id: string): number {
  const fork = flow.steps[forkId];
  if (!fork?.branches) return 0;
  let count = 0;
  for (const branch of fork.branches) {
    if (reachableFrom(flow, branch.nextId).has(id)) count += 1;
  }
  return count;
}

/**
 * Moves a step to another position by relinking `next` and `branches[].nextId`.
 * There is no `order` field to bump: the step is unstitched from where it sits
 * — its predecessors take over its successor, the same sewing rule deletion
 * uses — and stitched in at the target.
 *
 * Defined on a graph that already holds the four structural invariants, and it
 * refuses rather than guesses:
 *
 * - Moving a branch point would leave its predecessor with no defined successor
 *   and its branches hanging, so it is refused with `branch_point_move`.
 *   Relocating a condition together with its branches is a separate gesture,
 *   not this one.
 * - "after" a branch point is refused with `target_after_branch_point`.
 */
export function moveStep(flow: Flow, stepId: string, target: MoveStepTarget): MoveStepResult {
  const step = flow.steps[stepId];
  if (!step) return refuse("unknown_step", `step "${stepId}" is not a step of this flow`);

  const anchor = flow.steps[target.stepId];
  if (!anchor) {
    return refuse("unknown_target", `target "${target.stepId}" is not a step of this flow`);
  }

  if (target.stepId === stepId) {
    return refuse("self_target", `step "${stepId}" cannot be moved relative to itself`);
  }

  const inputViolations = checkFlowInvariants(flow);
  if (inputViolations.length > 0) {
    return refuse(
      "invalid_input",
      `flow "${flow.id}" does not hold the structural invariants; repair it before moving steps`,
      inputViolations,
    );
  }

  if (step.branches && step.branches.length > 0) {
    return refuse(
      "branch_point_move",
      `step "${stepId}" is a branch point; moving it would leave its branches with no defined attachment`,
    );
  }

  if (target.kind === "after" && anchor.branches && anchor.branches.length > 0) {
    return refuse(
      "target_after_branch_point",
      `step "${target.stepId}" is a branch point; use branchStart to move into one of its branches`,
    );
  }

  let branchHead: string | undefined;
  if (target.kind === "branchStart") {
    if (!anchor.branches || anchor.branches.length === 0) {
      return refuse("invalid_branch_index", `step "${target.stepId}" has no branches`);
    }
    if (target.branchIndex < 0 || target.branchIndex >= anchor.branches.length) {
      return refuse(
        "invalid_branch_index",
        `step "${target.stepId}" has no branch at index ${target.branchIndex}`,
      );
    }
    branchHead = anchor.branches[target.branchIndex]!.nextId;
  }

  // The moved step has no branches, so it has at most one successor to hand
  // over to whoever pointed at it.
  const successor = step.next;

  const steps: Record<string, FlowStep> = {};
  for (const [id, current] of Object.entries(flow.steps)) {
    if (id === stepId) continue;
    const copy: FlowStep = { ...current };

    if (copy.next === stepId) {
      if (successor !== undefined) copy.next = successor;
      else delete copy.next;
    }

    if (copy.branches !== undefined) {
      // The target branch is rewritten in the same pass as the unstitch, so a
      // branch dropped here cannot shift the slot the step is moving into.
      const isTargetAnchor = target.kind === "branchStart" && id === target.stepId;
      const branches = copy.branches
        .map((branch, index): FlowBranch | null => {
          if (isTargetAnchor && index === target.branchIndex) {
            return { ...branch, nextId: stepId };
          }
          if (branch.nextId !== stepId) return branch;
          return successor !== undefined ? { ...branch, nextId: successor } : null;
        })
        .filter((branch): branch is FlowBranch => branch !== null);
      if (branches.length > 0) copy.branches = branches;
      else delete copy.branches;
    }

    steps[id] = copy;
  }

  let entryStepId = flow.entryStepId === stepId ? successor : flow.entryStepId;

  const moved: FlowStep = { ...step };
  delete moved.next;
  steps[stepId] = moved;

  if (target.kind === "before") {
    for (const id of Object.keys(steps)) {
      if (id === stepId) continue;
      const current = steps[id]!;
      if (current.next === target.stepId) current.next = stepId;
      if (current.branches) {
        current.branches = current.branches.map((branch) =>
          branch.nextId === target.stepId ? { ...branch, nextId: stepId } : branch,
        );
      }
    }
    moved.next = target.stepId;
    if (entryStepId === target.stepId) entryStepId = stepId;
  } else if (target.kind === "after") {
    const anchorAfter = steps[target.stepId]!;
    if (anchorAfter.next !== undefined) moved.next = anchorAfter.next;
    anchorAfter.next = stepId;
  } else {
    // The branch already points at the moved step; it only needs its old head
    // hung behind it. When the step was that head, it keeps its own successor.
    const head = branchHead === stepId ? successor : branchHead;
    if (head !== undefined) moved.next = head;
  }

  const movedFlow: Flow = { ...flow, steps, entryStepId };
  const violations = checkFlowInvariants(movedFlow);
  if (violations.length > 0) {
    return refuse(
      "invariant_violated",
      `moving "${stepId}" would break the flow's structural invariants`,
      violations,
    );
  }

  // The graph stays valid either way — that is exactly why this has to be
  // checked separately. `checkFlowInvariants` answers "is this a flow", not
  // "is this still the flow the author drew".
  const brokenFork = brokenJoinFork(flow, movedFlow, stepId);
  if (brokenFork !== null) {
    return refuse(
      "join_broken",
      `step "${stepId}" is where the branches of "${brokenFork}" meet again; moving it there would undo that`,
    );
  }

  return { ok: true, steps, entryStepId };
}
