import type { Flow, FlowStep } from "@/features/diagram";
import { buildCallStack, buildFlowOutline, canReachStep, getPathToStep } from "@/features/diagram";
import { buildRunningContext, framesClosedByStep } from "../reading/readingVariables";

/**
 * The object a script carries, seen from inside one of its steps.
 *
 * One object for the whole flow, not a table per step: the panel sits outside
 * the steps and changes as the author moves between them — *at that step, it
 * has this value*. What the author edits there becomes that step's own `sets`,
 * so nothing about the model changes; this is a lens over it.
 *
 * The object *includes* what the selected step writes, unlike the scope panel
 * it replaces, which held the step's own contribution back on purpose. Here the
 * author is editing the object as it ends up, and hiding half of that would be
 * lying about the result.
 */

export interface ObjectRow {
  key: string;
  /** The value in force at this step, or null for a key nothing sets. */
  value: string | null;
  /** The selected step is the one that writes it. */
  written: boolean;
  /** The selected step consumes it. */
  read: boolean;
  /** Reading number of the step that wrote it — `3`, `4a.1`. Empty when none does. */
  fromNumber: string;
  fromStepId: string | null;
  /**
   * Number of the step where this value stops existing, when one is reachable.
   *
   * A value written inside a call goes when the call returns. The reading says
   * so with a mark at the moment it happens; an author writing a step further
   * down needs to know *before* they lean on it. Only when the answering step
   * can actually be reached from here — a call answered inside one branch is
   * never answered on the other.
   */
  endsAtNumber: string | null;
}

export interface FlowObject {
  rows: ObjectRow[];
  /** The step the object is shown at, or null when it is the end of the script. */
  atStepId: string | null;
  /** Reading number of that step, for the panel's heading. */
  atNumber: string;
}

const EMPTY: FlowObject = { rows: [], atStepId: null, atNumber: "" };

/** The last row of the outline — one complete run through the script. */
function lastStepId(flow: Flow): string | null {
  const rows = buildFlowOutline(flow).rows;
  return rows[rows.length - 1]?.stepId ?? null;
}

export function buildFlowObject(flow: Flow, stepId: string | null): FlowObject {
  const outline = buildFlowOutline(flow);
  const numbers = new Map(outline.rows.map((row) => [row.stepId, row.label]));
  const target = stepId ?? lastStepId(flow);
  if (!target) return EMPTY;

  const path = getPathToStep(flow, target);
  if (path.length === 0) return { ...EMPTY, atStepId: stepId, atNumber: numbers.get(target) ?? "" };

  const callStack = buildCallStack(flow, outline);
  const running = buildRunningContext(flow, callStack, path);
  const closedBy = framesClosedByStep(callStack);
  const step: FlowStep | undefined = stepId ? flow.steps[stepId] : undefined;
  const reads = step?.context?.reads ?? [];

  const rows: ObjectRow[] = running.entries.map((entry) => {
    const closer = entry.frameId ? closedBy.get(entry.frameId) : undefined;
    const ends = closer && canReachStep(flow, target, closer) ? closer : undefined;
    return {
      key: entry.key,
      value: entry.value,
      written: entry.fromStepId === stepId,
      read: reads.includes(entry.key),
      fromNumber: numbers.get(entry.fromStepId) ?? "",
      fromStepId: entry.fromStepId,
      endsAtNumber: ends ? (numbers.get(ends) ?? null) : null,
    };
  });

  // A key the step consumes that the object does not hold still needs a line:
  // it is the one thing about the object that is wrong, and the chips it
  // replaces had nowhere to say so.
  for (const key of reads) {
    if (running.byKey.has(key)) continue;
    rows.push({
      key,
      value: null,
      written: false,
      read: true,
      fromNumber: "",
      fromStepId: null,
      endsAtNumber: null,
    });
  }

  return { rows, atStepId: stepId, atNumber: stepId ? (numbers.get(stepId) ?? "") : "" };
}

/** The step's values with one key written, or cleared when `value` is null. */
export function withKey(
  step: FlowStep,
  key: string,
  value: string | null,
): Record<string, string> | undefined {
  const sets = { ...step.context?.sets };
  if (value === null) delete sets[key];
  else sets[key] = value;
  return Object.keys(sets).length > 0 ? sets : undefined;
}

/** The step's reads with one key turned on or off. */
export function withRead(step: FlowStep, key: string): string[] | undefined {
  const reads = step.context?.reads ?? [];
  const next = reads.includes(key) ? reads.filter((read) => read !== key) : [...reads, key];
  return next.length > 0 ? next : undefined;
}
