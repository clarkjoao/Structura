import { buildFlowOutline, getBranchRows, isConditionStep } from "@/features/diagram";
import type { Flow, FlowStep } from "@/features/diagram";
import { getBranchColor } from "../branchColors";

/** One of the ways out of a condition, summarised for the spine. */
export interface ReadingBranch {
  index: number;
  label: string;
  color: string;
  /** How many steps the branch holds, counting everything nested under it. */
  stepCount: number;
  /** The branch's first heading, so it says where it goes and not only how far. */
  lead?: string;
}

export interface ReadingRow {
  stepId: string;
  /** Derived label — `3`, `4a.1`. Never stored on the step. */
  number: string;
  heading: string;
  isCondition: boolean;
  /** How many ways out a condition offers; 0 on every other row. */
  exits: number;
}

/**
 * The reading as one vertical list: what has been walked, what is in hand, and
 * what is still ahead on this path.
 *
 * The spine is the only progress indicator the rail has, so it has to describe
 * the *reading* rather than the script — `past` is the walk that actually
 * happened, and `upcoming` runs forward only as far as the next choice, which
 * is the last point anyone can honestly say what comes next.
 */
export interface ReadingSpine {
  past: ReadingRow[];
  current: ReadingRow | null;
  upcoming: ReadingRow[];
  /** The branches waiting at the end of what the spine shows. */
  branches: ReadingBranch[];
}

export function buildReadingSpine(
  flow: Flow,
  currentStepId: string | null,
  history: readonly string[],
  heading: (step: FlowStep) => string,
): ReadingSpine {
  const outline = buildFlowOutline(flow);
  const numbers = new Map(outline.rows.map((row) => [row.stepId, row.label]));

  const row = (stepId: string): ReadingRow | null => {
    const step = flow.steps[stepId];
    if (!step) return null;
    return {
      stepId,
      number: numbers.get(stepId) ?? "",
      heading: heading(step),
      isCondition: isConditionStep(step),
      exits: step.branches?.length ?? 0,
    };
  };

  const branchesOf = (step: FlowStep): ReadingBranch[] =>
    (step.branches ?? []).map((branch, index) => {
      const head = flow.steps[branch.nextId];
      return {
        index,
        label: branch.label,
        color: getBranchColor(index),
        stepCount: getBranchRows(outline, step.id, index).length,
        lead: head ? heading(head) : undefined,
      };
    });

  const past = history.map(row).filter((entry): entry is ReadingRow => entry !== null);
  const current = currentStepId ? row(currentStepId) : null;

  const upcoming: ReadingRow[] = [];
  let branches: ReadingBranch[] = [];

  const currentStep = currentStepId ? flow.steps[currentStepId] : undefined;
  if (currentStep && isConditionStep(currentStep)) {
    branches = branchesOf(currentStep);
  } else {
    // A cycle would otherwise list its way around the loop forever; the walk
    // stops the second time it reaches a step, the same guard `stepsAhead` uses.
    const seen = new Set<string>([...history, ...(currentStepId ? [currentStepId] : [])]);
    let nextId = currentStep?.next;
    while (nextId && !seen.has(nextId)) {
      seen.add(nextId);
      const entry = row(nextId);
      if (!entry) break;
      upcoming.push(entry);
      const step = flow.steps[nextId]!;
      if (isConditionStep(step)) {
        branches = branchesOf(step);
        break;
      }
      nextId = step.next;
    }
  }

  return { past, current, upcoming, branches };
}
