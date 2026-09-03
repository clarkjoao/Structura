import type { Flow, FlowBranch, FlowStep } from "../model/flow.types";
import { checkFlowInvariants, getFlowOutEdges, type FlowInvariantViolation } from "./flow-graph";
import { branchLetter, compareFlowStepLabels, computeFlowStepLabels } from "./flow-labels";
import type { MoveStepTarget } from "./flow-move";

/**
 * Where the next recorded step goes: the main sequence, or inside one branch
 * of a condition. The recorder's old "context" said the same thing about a
 * flat array; here it is resolved against the graph.
 */
export type FlowCursor =
  { kind: "trunk" } | { kind: "branch"; conditionStepId: string; branchIndex: number };

export type FlowEditRefusalCode =
  | "duplicate_step_id"
  | "unknown_step"
  | "unknown_condition"
  | "invalid_branch_index"
  | "unlabeled_cursor"
  | "target_after_branch_point"
  | "invalid_input"
  | "invariant_violated";

export interface FlowEditRefusal {
  ok: false;
  code: FlowEditRefusalCode;
  detail: string;
  violations?: FlowInvariantViolation[];
}

export interface FlowEditSuccess {
  ok: true;
  steps: Record<string, FlowStep>;
  entryStepId: string | undefined;
  /** Steps dropped by the edit, in no particular order. Empty for pure additions. */
  removedStepIds: string[];
}

export type FlowEditResult = FlowEditSuccess | FlowEditRefusal;

/** Shared by the edit modules; not part of the package's public surface. */
export function refuse(
  code: FlowEditRefusalCode,
  detail: string,
  violations?: FlowInvariantViolation[],
): FlowEditRefusal {
  return violations ? { ok: false, code, detail, violations } : { ok: false, code, detail };
}

export function copySteps(flow: Flow): Record<string, FlowStep> {
  const steps: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(flow.steps)) steps[id] = { ...step };
  return steps;
}

export function settle(
  flow: Flow,
  steps: Record<string, FlowStep>,
  entryStepId: string | undefined,
  removedStepIds: string[],
  what: string,
): FlowEditResult {
  const violations = checkFlowInvariants({ ...flow, steps, entryStepId });
  if (violations.length > 0) {
    return refuse(
      "invariant_violated",
      `${what} would break the flow's structural invariants`,
      violations,
    );
  }
  return { ok: true, steps, entryStepId, removedStepIds };
}

const MAIN_SEQUENCE = /^\d+$/;
const ORDINAL = /^\d+$/;

/**
 * A step the recorder created to hold a place — a condition's branch always
 * has a real step behind it, so the graph never carries a dangling branch —
 * that nothing has filled in yet.
 */
export function isPlaceholderStep(step: FlowStep): boolean {
  return (
    step.type === "action" &&
    step.componentId === undefined &&
    step.connectionId === undefined &&
    !step.description?.trim() &&
    !step.note?.trim()
  );
}

/** Every reachable step below `fromStepId` that has no outgoing edge, `fromStepId` included. */
export function getOpenEndIds(flow: Flow, fromStepId: string): string[] {
  if (!flow.steps[fromStepId]) return [];
  const seen = new Set<string>([fromStepId]);
  const queue = [fromStepId];
  const ends: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const edges = getFlowOutEdges(flow, id);
    if (edges.length === 0) {
      ends.push(id);
      continue;
    }
    for (const edge of edges) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return ends;
}

/**
 * Last step of the sequence the cursor points at — where an append attaches.
 *
 * Read off the derived labels rather than re-walking the graph: the main
 * sequence is exactly the steps whose label is a bare number, and one branch
 * is exactly `3a` plus `3a.1`, `3a.2`. That is what makes a step where two
 * branches meet count as the trunk's tail rather than either branch's, with
 * no separate notion of "join" here.
 *
 * `undefined` when the sequence has no step yet, or when the cursor points at
 * something the numbering could not reach.
 */
export function getFlowTail(flow: Flow, cursor: FlowCursor): string | undefined {
  const { labels } = computeFlowStepLabels(flow);

  let match: (label: string) => boolean;
  if (cursor.kind === "trunk") {
    match = (label) => MAIN_SEQUENCE.test(label);
  } else {
    const conditionLabel = labels[cursor.conditionStepId];
    if (conditionLabel === undefined) return undefined;
    const prefix = `${conditionLabel}${branchLetter(cursor.branchIndex)}`;
    // The branch's own sequence is the head plus its dotted ordinals. Compared
    // as strings, not as a pattern: a label is not a safe regexp source, and a
    // deeper branch such as `3a.2b` must not read as part of `3a`.
    match = (label) =>
      label === prefix ||
      (label.startsWith(`${prefix}.`) && ORDINAL.test(label.slice(prefix.length + 1)));
  }

  let tail: string | undefined;
  let tailLabel: string | undefined;
  for (const [id, label] of Object.entries(labels)) {
    if (!match(label)) continue;
    if (tailLabel === undefined || compareFlowStepLabels(label, tailLabel) > 0) {
      tail = id;
      tailLabel = label;
    }
  }
  return tail;
}

/**
 * Appends a step at the end of the sequence the cursor points at.
 *
 * Appending to the trunk right after a condition is the reconvergence case:
 * the new step becomes the successor of every open end below the condition,
 * so the branches meet again instead of the step floating away unreachable.
 * A branch point never takes a `next` — a non-empty `branches` array shadows
 * it — which is why the wiring targets the open ends and not the anchor.
 */
export function appendFlowStep(flow: Flow, step: FlowStep, cursor: FlowCursor): FlowEditResult {
  if (flow.steps[step.id]) {
    return refuse("duplicate_step_id", `step "${step.id}" is already a step of this flow`);
  }

  const inputViolations = checkFlowInvariants(flow);
  if (inputViolations.length > 0) {
    return refuse(
      "invalid_input",
      `flow "${flow.id}" does not hold the structural invariants; repair it before editing`,
      inputViolations,
    );
  }

  if (cursor.kind === "branch") {
    const condition = flow.steps[cursor.conditionStepId];
    if (!condition) {
      return refuse(
        "unknown_condition",
        `step "${cursor.conditionStepId}" is not a step of this flow`,
      );
    }
    if (
      !condition.branches ||
      cursor.branchIndex >= condition.branches.length ||
      cursor.branchIndex < 0
    ) {
      return refuse(
        "invalid_branch_index",
        `step "${cursor.conditionStepId}" has no branch at index ${cursor.branchIndex}`,
      );
    }
  }

  const anchorId = getFlowTail(flow, cursor);
  const steps = copySteps(flow);
  steps[step.id] = { ...step };
  let entryStepId = flow.entryStepId;

  if (anchorId === undefined) {
    if (cursor.kind === "branch") {
      return refuse(
        "unlabeled_cursor",
        `branch ${cursor.branchIndex} of "${cursor.conditionStepId}" has no sequence of its own to append to`,
      );
    }
    entryStepId = step.id;
  } else {
    for (const openEnd of getOpenEndIds(flow, anchorId)) steps[openEnd]!.next = step.id;
  }

  return settle(flow, steps, entryStepId, [], `appending "${step.id}"`);
}

/**
 * Inserts a new step at an explicit position, using the same target vocabulary
 * as `moveStep` so the script panel speaks one language for both gestures.
 */
export function insertFlowStep(flow: Flow, step: FlowStep, target: MoveStepTarget): FlowEditResult {
  if (flow.steps[step.id]) {
    return refuse("duplicate_step_id", `step "${step.id}" is already a step of this flow`);
  }

  const anchor = flow.steps[target.stepId];
  if (!anchor) {
    return refuse("unknown_step", `step "${target.stepId}" is not a step of this flow`);
  }

  const inputViolations = checkFlowInvariants(flow);
  if (inputViolations.length > 0) {
    return refuse(
      "invalid_input",
      `flow "${flow.id}" does not hold the structural invariants; repair it before editing`,
      inputViolations,
    );
  }

  if (target.kind === "after" && anchor.branches && anchor.branches.length > 0) {
    return refuse(
      "target_after_branch_point",
      `step "${target.stepId}" is a branch point; insert into one of its branches instead`,
    );
  }

  if (target.kind === "branchStart") {
    if (
      !anchor.branches ||
      target.branchIndex < 0 ||
      target.branchIndex >= anchor.branches.length
    ) {
      return refuse(
        "invalid_branch_index",
        `step "${target.stepId}" has no branch at index ${target.branchIndex}`,
      );
    }
  }

  const steps = copySteps(flow);
  const inserted: FlowStep = { ...step };
  steps[step.id] = inserted;
  let entryStepId = flow.entryStepId;

  if (target.kind === "before") {
    for (const [id, current] of Object.entries(steps)) {
      if (id === step.id) continue;
      if (current.next === target.stepId) current.next = step.id;
      if (current.branches) {
        current.branches = current.branches.map((branch) =>
          branch.nextId === target.stepId ? { ...branch, nextId: step.id } : branch,
        );
      }
    }
    inserted.next = target.stepId;
    if (entryStepId === target.stepId) entryStepId = step.id;
  } else if (target.kind === "after") {
    const anchorAfter = steps[target.stepId]!;
    if (anchorAfter.next !== undefined) inserted.next = anchorAfter.next;
    anchorAfter.next = step.id;
  } else {
    const anchorBranch = steps[target.stepId]!;
    const branches = anchorBranch.branches!.map((branch, index): FlowBranch => {
      if (index !== target.branchIndex) return branch;
      inserted.next = branch.nextId;
      return { ...branch, nextId: step.id };
    });
    anchorBranch.branches = branches;
  }

  return settle(flow, steps, entryStepId, [], `inserting "${step.id}"`);
}
