import type { Flow } from "../model/flow.types";

/**
 * One traversable edge of a flow graph.
 *
 * `branchIndex` is the position of the branch in the owner step's `branches`
 * array; it is `undefined` for a plain `next` edge.
 */
export interface FlowEdge {
  from: string;
  to: string;
  branchIndex?: number;
}

/**
 * Outgoing edges of a step, using the same semantics as `getNextSteps`:
 * a non-empty `branches` array shadows `next` entirely. Edges pointing at
 * ids that are absent from `flow.steps` are dropped — `checkFlowInvariants`
 * reports those separately as dangling references.
 *
 * Branch indices are the declared positions, so a dangling branch keeps its
 * slot instead of shifting the letters of the branches after it.
 */
export function getFlowOutEdges(flow: Flow, stepId: string): FlowEdge[] {
  const step = flow.steps[stepId];
  if (!step) return [];

  if (step.branches && step.branches.length > 0) {
    const edges: FlowEdge[] = [];
    step.branches.forEach((branch, branchIndex) => {
      if (flow.steps[branch.nextId]) edges.push({ from: stepId, to: branch.nextId, branchIndex });
    });
    return edges;
  }

  if (step.next && flow.steps[step.next]) {
    return [{ from: stepId, to: step.next }];
  }

  return [];
}

/** Step ids reachable from `entryStepId`, in breadth-first discovery order. */
export function getReachableStepIds(flow: Flow): string[] {
  const entry = flow.entryStepId;
  if (!entry || !flow.steps[entry]) return [];

  const seen = new Set<string>([entry]);
  const out: string[] = [];
  const queue: string[] = [entry];

  while (queue.length > 0) {
    const id = queue.shift()!;
    out.push(id);
    for (const edge of getFlowOutEdges(flow, id)) {
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return out;
}

export type FlowInvariantCode =
  "missing_entry" | "dangling_reference" | "unreachable_step" | "cycle";

export interface FlowInvariantViolation {
  code: FlowInvariantCode;
  /** Step the violation is attributed to; absent for `missing_entry`. */
  stepId?: string;
  /** Referenced id, for dangling references and cycles. */
  targetId?: string;
  detail: string;
}

/**
 * The four structural invariants every flow-graph operation must preserve:
 * every step reachable from the entry, no cycles, no dangling references,
 * and an `entryStepId` that exists in the record.
 *
 * This is a reporter, not an enforcer: flows already persisted by earlier
 * versions can violate it, and callers decide what to do about that.
 */
export function checkFlowInvariants(flow: Flow): FlowInvariantViolation[] {
  const violations: FlowInvariantViolation[] = [];
  const ids = Object.keys(flow.steps);

  // 4. entryStepId exists in the record (an empty flow has no entry to point at).
  if (ids.length === 0) {
    if (flow.entryStepId !== undefined) {
      violations.push({
        code: "missing_entry",
        detail: `entryStepId "${flow.entryStepId}" is set on a flow with no steps`,
      });
    }
  } else if (!flow.entryStepId) {
    violations.push({ code: "missing_entry", detail: "flow has steps but no entryStepId" });
  } else if (!flow.steps[flow.entryStepId]) {
    violations.push({
      code: "missing_entry",
      detail: `entryStepId "${flow.entryStepId}" is not a step of this flow`,
    });
  }

  // 3. No next / branches[].nextId pointing at an id that does not exist.
  for (const id of ids) {
    const step = flow.steps[id]!;
    if (step.next !== undefined && !flow.steps[step.next]) {
      violations.push({
        code: "dangling_reference",
        stepId: id,
        targetId: step.next,
        detail: `step "${id}" has next "${step.next}", which is not a step of this flow`,
      });
    }
    step.branches?.forEach((branch, branchIndex) => {
      if (!flow.steps[branch.nextId]) {
        violations.push({
          code: "dangling_reference",
          stepId: id,
          targetId: branch.nextId,
          detail: `step "${id}" branch ${branchIndex} ("${branch.label}") points at "${branch.nextId}", which is not a step of this flow`,
        });
      }
    });
  }

  // 1. Every step reachable from entryStepId.
  const reachable = new Set(getReachableStepIds(flow));
  for (const id of ids) {
    if (!reachable.has(id)) {
      violations.push({
        code: "unreachable_step",
        stepId: id,
        detail: `step "${id}" is not reachable from the entry step`,
      });
    }
  }

  // 2. No cycle. Iterative colouring over every step, so cycles among
  //    unreachable steps are reported too.
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>(ids.map((id) => [id, WHITE]));
  const reported = new Set<string>();

  for (const root of ids) {
    if (colour.get(root) !== WHITE) continue;
    const stack: { id: string; edges: FlowEdge[]; cursor: number }[] = [
      { id: root, edges: getFlowOutEdges(flow, root), cursor: 0 },
    ];
    colour.set(root, GREY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      if (frame.cursor >= frame.edges.length) {
        colour.set(frame.id, BLACK);
        stack.pop();
        continue;
      }
      const edge = frame.edges[frame.cursor++]!;
      const state = colour.get(edge.to);
      if (state === GREY) {
        const key = `${edge.from}->${edge.to}`;
        if (!reported.has(key)) {
          reported.add(key);
          violations.push({
            code: "cycle",
            stepId: edge.from,
            targetId: edge.to,
            detail: `step "${edge.from}" closes a cycle back onto "${edge.to}"`,
          });
        }
      } else if (state === WHITE) {
        colour.set(edge.to, GREY);
        stack.push({ id: edge.to, edges: getFlowOutEdges(flow, edge.to), cursor: 0 });
      }
    }
  }

  return violations;
}
