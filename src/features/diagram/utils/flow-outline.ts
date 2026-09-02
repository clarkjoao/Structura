import type { Flow } from "../model/flow.types";
import { computeFlowStepLabels, type FlowLabelAmbiguity } from "./flow-labels";

/** The branch a row sits inside. Absent on the main sequence. */
export interface FlowOutlineBranch {
  conditionStepId: string;
  branchIndex: number;
  label: string;
}

export interface FlowOutlineRow {
  stepId: string;
  /** Derived label — `3`, `3a`, `3a.1`. Never stored on the step. */
  label: string;
  /** How many branches deep the row sits; 0 on the main sequence. */
  depth: number;
  /** True when the row opens branches of its own. */
  isBranchPoint: boolean;
  /** True when the row is the first step of its branch. */
  isBranchHead: boolean;
  branch?: FlowOutlineBranch;
}

export interface FlowOutline {
  /** Every reachable step, in reading order: `3`, `3a`, `3a.1`, `3b`, `4`. */
  rows: FlowOutlineRow[];
  /** Steps the numbering could not reach, so the panel can say so instead of hiding them. */
  unreachable: string[];
  ambiguities: FlowLabelAmbiguity[];
  collisions: string[];
}

const SEGMENT = /^(\d+)([a-z]*)$/;

/**
 * How deep a label sits: one level per segment that carries a branch letter.
 * `3` → 0, `3a` → 1, `3a.1` → 1, `3a.2b` → 2, `3a.2b.1` → 2.
 */
export function flowLabelDepth(label: string): number {
  let depth = 0;
  for (const part of label.split(".")) {
    const match = SEGMENT.exec(part);
    if (match && match[2]) depth += 1;
  }
  return depth;
}

/**
 * Label of the branch head a label belongs to: everything up to and including
 * the last lettered segment. `3a.2` → `3a`, `3a.2b.1` → `3a.2b`, `3a` → `3a`.
 * `undefined` on the main sequence, which has no branch head.
 */
export function flowBranchHeadLabel(label: string): string | undefined {
  const parts = label.split(".");
  let last = -1;
  for (let i = 0; i < parts.length; i++) {
    const match = SEGMENT.exec(parts[i]!);
    if (match && match[2]) last = i;
  }
  if (last < 0) return undefined;
  return parts.slice(0, last + 1).join(".");
}

/**
 * The flow as the script panel reads it: one row per reachable step, in
 * reading order, each carrying its derived label, how far it is indented, and
 * which branch it sits in.
 *
 * Everything here comes off `computeFlowStepLabels` and the graph's edges;
 * nothing is stored on the step and nothing re-walks the graph on its own.
 */
export function buildFlowOutline(flow: Flow): FlowOutline {
  const { labels, order, unlabeled, ambiguities, collisions } = computeFlowStepLabels(flow);

  const stepIdByLabel = new Map<string, string>();
  for (const stepId of order) {
    const label = labels[stepId]!;
    if (!stepIdByLabel.has(label)) stepIdByLabel.set(label, stepId);
  }

  /** stepId of a branch head → the condition and index that open it. */
  const branchOf = new Map<string, FlowOutlineBranch>();
  for (const stepId of order) {
    const step = flow.steps[stepId];
    if (!step?.branches) continue;
    step.branches.forEach((branch, branchIndex) => {
      if (branchOf.has(branch.nextId)) return;
      branchOf.set(branch.nextId, { conditionStepId: stepId, branchIndex, label: branch.label });
    });
  }

  const rows: FlowOutlineRow[] = order.map((stepId) => {
    const label = labels[stepId]!;
    const step = flow.steps[stepId];
    const headLabel = flowBranchHeadLabel(label);
    const headStepId = headLabel === undefined ? undefined : stepIdByLabel.get(headLabel);
    const branch = headStepId === undefined ? undefined : branchOf.get(headStepId);
    return {
      stepId,
      label,
      depth: flowLabelDepth(label),
      isBranchPoint: Boolean(step?.branches && step.branches.length > 0),
      isBranchHead: headStepId === stepId,
      branch,
    };
  });

  return { rows, unreachable: unlabeled, ambiguities, collisions };
}

/**
 * The rows that belong to one branch: its own sequence plus everything nested
 * under it.
 *
 * In reading order that is one contiguous run starting at the head. It ends at
 * the first row that is neither deeper than the head — those are nested inside
 * it — nor part of this same branch. That is what keeps the next branch of the
 * same condition out, since it sits at the very same depth, and what keeps out
 * the step where the branches meet again, which is back on the sequence
 * outside.
 */
export function getBranchRows(
  outline: FlowOutline,
  conditionStepId: string,
  branchIndex: number,
): FlowOutlineRow[] {
  const start = outline.rows.findIndex(
    (row) =>
      row.isBranchHead &&
      row.branch?.conditionStepId === conditionStepId &&
      row.branch.branchIndex === branchIndex,
  );
  if (start < 0) return [];
  const headDepth = outline.rows[start]!.depth;
  const rows: FlowOutlineRow[] = [];
  for (let i = start; i < outline.rows.length; i++) {
    const row = outline.rows[i]!;
    const nested = row.depth > headDepth;
    const sameBranch =
      row.branch?.conditionStepId === conditionStepId && row.branch.branchIndex === branchIndex;
    if (i > start && !nested && !sameBranch) break;
    rows.push(row);
  }
  return rows;
}
