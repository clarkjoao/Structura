import type { FlowConditionKind, FlowStep } from "../model/flow.types";
import { isConditionStep } from "./flow-traversal";

/** Every kind a branch point can be, in the order the editor offers them. */
export const FLOW_CONDITION_KINDS: readonly FlowConditionKind[] = [
  "alt",
  "opt",
  "loop",
  "par",
  "critical",
  "break",
];

/**
 * The kind a branch point is.
 *
 * `alt` is the answer for everything that does not say otherwise — a condition
 * written before the field existed, and one an author never touched. This is
 * the only place that default lives, so nothing else has to know it.
 */
export function conditionKindOf(step: FlowStep): FlowConditionKind {
  return step.conditionKind ?? "alt";
}

/** The kind named by a string, or `undefined` when the string names none. */
export function parseConditionKind(value: string | undefined): FlowConditionKind | undefined {
  const normalized = value?.trim().toLowerCase();
  return FLOW_CONDITION_KINDS.find((kind) => kind === normalized);
}

/**
 * Whether the ways out of this step all happen, rather than one being chosen.
 *
 * The single question the reading asks about a branch point: a `par` forks into
 * threads that run alongside each other, and every other kind is a fork in the
 * road. Everything the rail does differently for a parallel step hangs off this.
 */
export function isParallelStep(step: FlowStep): boolean {
  return isConditionStep(step) && conditionKindOf(step) === "par";
}
