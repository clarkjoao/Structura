import {
  buildCallStack,
  buildFlowOutline,
  conditionKindOf,
  getBranchRows,
  isConditionStep,
} from "@/features/diagram";
import type { Flow, FlowConditionKind, FlowStep } from "@/features/diagram";
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
  /**
   * True once the reading has been down this way.
   *
   * Not the same fact as a spine row being walked, which asks whether the step
   * is on the path to the one in hand: this asks whether the reader has *ever*
   * been there, which turning back does not undo. Only says something on a
   * branch point whose ways out all happen — a reader who followed one thread
   * of a `par` needs to see which of the others they have been through, since
   * all of them ran either way.
   */
  visited: boolean;
}

/**
 * A call ending where nobody wrote the return.
 *
 * It is drawn as a row and is nothing else: it has no step, so the reading
 * never lands on it and the flow never gains one. The connection is carried
 * rather than a name because naming the caller needs the diagram, which is the
 * rail's to know, not the spine's.
 */
export interface ReadingReturn {
  frameId: string;
  callDepth: number;
  connectionId: string;
}

export interface ReadingRow {
  stepId: string;
  /** Derived label — `3`, `4a.1`. Never stored on the step. */
  number: string;
  heading: string;
  isCondition: boolean;
  /** How many ways out a condition offers; 0 on every other row. */
  exits: number;
  /** What kind of branch point this is. Absent on every row that is not one. */
  conditionKind?: FlowConditionKind;
  /** How many calls are open around this row. 0 throughout a flat script. */
  callDepth: number;
  opensFrame: boolean;
  closesFrame: boolean;
  /** Calls that end immediately before this row, innermost first. */
  returnsBefore?: ReadingReturn[];
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
  /**
   * Every step the reading has stood on, which is not the same as the path it
   * took to get here: going back shortens the path and not the visit. Defaults
   * to the path, which is the best answer available when nobody is keeping the
   * longer one.
   */
  seen: readonly string[] = history,
): ReadingSpine {
  const outline = buildFlowOutline(flow);
  const numbers = new Map(outline.rows.map((row) => [row.stepId, row.label]));
  const callStack = buildCallStack(flow, outline);

  const row = (stepId: string): ReadingRow | null => {
    const step = flow.steps[stepId];
    if (!step) return null;
    const frames = callStack.byStep.get(stepId);
    const returns = callStack.derivedReturnsBefore.get(stepId);
    const isCondition = isConditionStep(step);
    return {
      stepId,
      number: numbers.get(stepId) ?? "",
      heading: heading(step),
      isCondition,
      exits: step.branches?.length ?? 0,
      ...(isCondition ? { conditionKind: conditionKindOf(step) } : {}),
      callDepth: frames?.callDepth ?? 0,
      opensFrame: Boolean(frames?.opensFrameId),
      closesFrame: Boolean(frames?.closesFrameId),
      ...(returns && returns.length > 0
        ? {
            returnsBefore: returns.map((entry) => ({
              frameId: entry.frameId,
              callDepth: entry.callDepth,
              connectionId: callStack.frames.get(entry.frameId)?.connectionId ?? "",
            })),
          }
        : {}),
    };
  };

  const visitedStepIds = new Set(seen);

  const branchesOf = (step: FlowStep): ReadingBranch[] =>
    (step.branches ?? []).map((branch, index) => {
      const head = flow.steps[branch.nextId];
      return {
        index,
        label: branch.label,
        color: getBranchColor(index),
        stepCount: getBranchRows(outline, step.id, index).length,
        lead: head ? heading(head) : undefined,
        // Entering the branch is what counts as having been down it: a reading
        // that turned back after one step still went that way, and the head is
        // the only step every path through the branch has to pass.
        visited: visitedStepIds.has(branch.nextId),
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
