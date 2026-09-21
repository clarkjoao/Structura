import type { Flow, FlowStep } from "../model/flow.types";
import type { Diagram, VersionDiff } from "../model/diagram.types";
import { resolveVersionSnapshot } from "./version.utils";

// ─── Graph edge types (from flow-graph.ts) ────────────────────────────────────

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

// ─── Step lookup ───────────────────────────────────────────────────────────────

export function getStepById(flow: Flow, id: string): FlowStep | undefined {
  return flow.steps[id];
}

export function getNextSteps(flow: Flow, stepId: string): FlowStep[] {
  const step = flow.steps[stepId];
  if (!step) return [];

  if (step.branches && step.branches.length > 0) {
    return step.branches.map((b) => flow.steps[b.nextId]).filter((s): s is FlowStep => !!s);
  }

  if (step.next) {
    const next = flow.steps[step.next];
    return next ? [next] : [];
  }

  return [];
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

export function isConditionStep(step: FlowStep): boolean {
  return step.type === "condition" && !!step.branches && step.branches.length > 0;
}

export function getEntryStep(flow: Flow): FlowStep | undefined {
  if (flow.entryStepId) return flow.steps[flow.entryStepId];
  return undefined;
}

/**
 * One way a reading could arrive at this step, from the entry to the step
 * itself.
 *
 * *One* way, because a step inside a branch is reached only by the branch that
 * leads to it, and a step after two branches meet is reached by either — the
 * first path found is taken, which is the one a reader following the script
 * top to bottom would walk. What was set before the step therefore depends on
 * which way in, and this answers for that way.
 *
 * Empty when the step is unreachable, which is the honest answer: nothing runs
 * before a step nothing leads to.
 */
export function getPathToStep(flow: Flow, stepId: string): string[] {
  const entry = getEntryStep(flow);
  if (!entry || !flow.steps[stepId]) return [];

  const path: string[] = [];
  const onPath = new Set<string>();

  const walk = (id: string): boolean => {
    if (onPath.has(id)) return false;
    const step = flow.steps[id];
    if (!step) return false;

    onPath.add(id);
    path.push(id);
    if (id === stepId) return true;

    for (const next of getNextSteps(flow, id)) {
      if (walk(next.id)) return true;
    }

    path.pop();
    onPath.delete(id);
    return false;
  };

  return walk(entry.id) ? path : [];
}

/**
 * Whether a reading standing on one step could ever arrive at another.
 *
 * Asked of claims about what happens *after* a step, which `getPathToStep`
 * cannot answer — it walks from the entry, and a step that answers a call from
 * inside one branch is not on the path to a step in the other. Without this,
 * such a claim reads as certain to a reader whose branch never reaches it.
 *
 * `false` for a step that cannot reach itself: a plain step is not ahead of
 * itself, and one in a cycle is found on the way round.
 */
export function canReachStep(flow: Flow, fromStepId: string, targetStepId: string): boolean {
  if (!flow.steps[fromStepId] || !flow.steps[targetStepId]) return false;

  const seen = new Set<string>();
  const queue = getNextSteps(flow, fromStepId).map((step) => step.id);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === targetStepId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of getNextSteps(flow, id)) queue.push(next.id);
  }

  return false;
}

export function walkFlow(flow: Flow, visitor: (step: FlowStep) => void): void {
  const entry = getEntryStep(flow);
  if (!entry) return;

  const visited = new Set<string>();
  const stack: FlowStep[] = [entry];

  while (stack.length > 0) {
    const step = stack.pop()!;
    if (visited.has(step.id)) continue;
    visited.add(step.id);
    visitor(step);

    const nexts = getNextSteps(flow, step.id);
    for (let i = nexts.length - 1; i >= 0; i--) {
      if (!visited.has(nexts[i].id)) stack.push(nexts[i]);
    }
  }
}

export function getFlowParticipants(flow: Flow): {
  componentIds: Set<string>;
  connectionIds: Set<string>;
} {
  const componentIds = new Set<string>();
  const connectionIds = new Set<string>();

  walkFlow(flow, (step) => {
    // A route is a component, so it belongs in the same set: coverage and the
    // playback highlight then reach an endpoint the script calls without either
    // of them learning a new kind of participant.
    if (step.endpointId) componentIds.add(step.endpointId);
    if (step.componentId) componentIds.add(step.componentId);
    if (step.connectionId) connectionIds.add(step.connectionId);
  });

  return { componentIds, connectionIds };
}

export interface BrokenStep {
  stepId: string;
  reason: "component_deleted" | "connection_deleted";
  missingId: string;
  label: string;
  /**
   * The scene that still holds the missing element, when one does.
   *
   * A scene keeps what it created in its own diff, so from anywhere else in
   * the diagram that element is absent from the view and from the base alike
   * — the same shape a genuinely deleted one has. The step cannot play from
   * here, but it is not garbage: removing it would throw away a reference that
   * works again the moment the scene is opened.
   */
  inVersion?: { id: string; name: string };
}

/**
 * The scene that owns `id`, if any scene does.
 *
 * Only a scene's *own* elements count. An element a scene merely hides is
 * still in the base, so it never reaches here.
 */
function versionHolding(
  versions: Record<string, VersionDiff> | undefined,
  id: string,
  kind: "component" | "connection",
): { id: string; name: string } | undefined {
  for (const scene of Object.values(versions ?? {})) {
    const own = kind === "component" ? scene.addedComponents : scene.addedConnections;
    if (own[id]) return { id: scene.id, name: scene.name };
  }
  return undefined;
}

function brokenStep(
  stepId: string,
  reason: BrokenStep["reason"],
  missingId: string,
  inVersion: { id: string; name: string } | undefined,
): BrokenStep {
  const what = reason === "component_deleted" ? "component" : "connection";
  const where = inVersion ? `lives in version “${inVersion.name}”` : "removed";
  return {
    stepId,
    reason,
    missingId,
    label: `Step ${stepId.slice(0, 8)}… — ${what} ${where} (${missingId.slice(0, 8)}…)`,
    inVersion,
  };
}

/**
 * The steps of `flow` whose element is gone from the model.
 *
 * Gone from the model, not merely out of sight: a scene *hides* base elements
 * instead of deleting them, so a component a scene has taken out of view is
 * still in `diagram.snapshot` and the step that names it still means what it
 * said. Reading only the scene's resolved view called those steps broken and
 * refused to play a flow that had nothing wrong with it. An id is missing only
 * when neither the view nor the base has it — which still covers a component
 * created inside a scene and then deleted, since the base never held it.
 *
 * Missing from *here* is not the same as gone, though: an element another
 * scene owns looks identical from outside that scene. Those steps are still
 * reported — the flow cannot play them from this view — but each carries the
 * scene that holds it, so a repair can tell the two apart instead of deleting
 * both.
 */
export function validateFlowGraph(flow: Flow, diagram: Diagram): BrokenStep[] {
  const broken: BrokenStep[] = [];
  const { components, connections } = resolveVersionSnapshot(
    diagram,
    diagram.activeVersionId ?? null,
  );
  const base = diagram.snapshot;
  const versions = diagram.versions;

  walkFlow(flow, (step) => {
    if (step.componentId && !components[step.componentId] && !base.components[step.componentId]) {
      const id = step.componentId;
      broken.push(
        brokenStep(step.id, "component_deleted", id, versionHolding(versions, id, "component")),
      );
    }
    if (
      step.connectionId &&
      !connections[step.connectionId] &&
      !base.connections[step.connectionId]
    ) {
      const id = step.connectionId;
      broken.push(
        brokenStep(step.id, "connection_deleted", id, versionHolding(versions, id, "connection")),
      );
    }
  });

  return broken;
}

export function getOrderedStepIds(flow: Flow): string[] {
  const ids: string[] = [];
  walkFlow(flow, (step) => ids.push(step.id));
  return ids;
}

export function getStepCount(flow: Flow): number {
  let count = 0;
  walkFlow(flow, () => count++);
  return count;
}

// ─── Flow invariants (from flow-graph.ts) ─────────────────────────────────────

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
