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

  return { ok: true, steps, entryStepId };
}
