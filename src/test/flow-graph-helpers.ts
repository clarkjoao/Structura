import { expect } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram/model/flow.types";
import { checkFlowInvariants } from "@/features/diagram/utils/flow-graph";

/**
 * Builds a flow from an explicit list of steps. Nothing is auto-chained: every
 * `next` and every branch is spelled out by the fixture, so a numbering test
 * asserts against a structure the reader can see.
 */
export function makeFlow(
  steps: FlowStep[],
  entryStepId?: string,
  overrides: Partial<Flow> = {},
): Flow {
  const record: Record<string, FlowStep> = {};
  for (const step of steps) record[step.id] = step;
  return {
    id: "flow-under-test",
    name: "Flow under test",
    mermaid: "",
    diagramId: "d-under-test",
    steps: record,
    entryStepId: entryStepId ?? steps[0]?.id,
    ...overrides,
  };
}

/** `chain("a", "b", "c")` → three action steps wired a → b → c. */
export function chain(...ids: string[]): FlowStep[] {
  return ids.map((id, index) => ({
    id,
    type: "action" as const,
    ...(ids[index + 1] ? { next: ids[index + 1] } : {}),
  }));
}

/** A condition step whose branches are given as `[label, targetId]` pairs, in declared order. */
export function condition(id: string, branches: [string, string][]): FlowStep {
  return {
    id,
    type: "condition",
    branches: branches.map(([label, nextId]) => ({ label, nextId })),
  };
}

/**
 * The four structural invariants, asserted through the single production
 * checker rather than re-expressed per test: every step reachable from the
 * entry, no cycle, no dangling reference, and an `entryStepId` in the record.
 */
export function expectFlowInvariants(flow: Flow): void {
  expect(checkFlowInvariants(flow)).toEqual([]);
}
