import type { Flow, FlowStep } from "../model/flow.types";
import { computeFlowStepLabels } from "./flow-labels";
import { sewOnDelete, type SewBlockedStep } from "./flow-sew";

/**
 * Backwards-compatible wrapper over `sewOnDelete`: same signature as before,
 * but the graph is now sewn rather than pruned. Callers that need to know
 * about a removal that was held back should use `sewOnDelete` directly.
 */
export function repairFlow(
  flow: Flow,
  stepIdsToRemove: string[] = [],
): { steps: Record<string, FlowStep>; entryStepId: string | undefined } {
  const { steps, entryStepId } = sewOnDelete(flow, stepIdsToRemove);
  return { steps, entryStepId };
}

export function getFlowStepIdsReferencingRemovedElements(
  flow: Flow,
  removedComponentIds: ReadonlySet<string>,
  removedConnectionIds: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const [stepId, step] of Object.entries(flow.steps)) {
    const refsRemovedComponent =
      step.componentId !== undefined && removedComponentIds.has(step.componentId);
    const refsRemovedConnection =
      step.connectionId !== undefined && removedConnectionIds.has(step.connectionId);
    if (refsRemovedComponent || refsRemovedConnection) {
      out.push(stepId);
    }
  }
  return out;
}

/** One step that left the flow, and where the script closed up behind it. */
export interface FlowSewJoin {
  stepId: string;
  componentId?: string;
  connectionId?: string;
  /** What the removed step was numbered before it went. */
  removedLabel?: string;
  /** After the sew: the step that now leads on, and the one it leads to. */
  fromLabel?: string;
  toLabel?: string;
}

export interface FlowSewReport {
  flowId: string;
  flowName: string;
  joins: FlowSewJoin[];
  blocked: SewBlockedStep[];
}

/** Steps that point at `stepId`, whether through `next` or through a branch. */
function predecessorsOf(flow: Flow, stepId: string): string[] {
  const out: string[] = [];
  for (const [id, step] of Object.entries(flow.steps)) {
    if (step.next === stepId || step.branches?.some((branch) => branch.nextId === stepId)) {
      out.push(id);
    }
  }
  return out;
}

/**
 * Sews every flow after diagram elements were removed, and says what happened.
 *
 * A step whose node left the diagram is not simply dropped: the script closes
 * up around it, which is a change to the user's flow that no one asked for
 * directly. The report carries the numbers on both sides of each join —
 * read before the sew for the step that went, after it for the two it joined
 * — so the caller can name the change rather than make it silently.
 *
 * Removals held back (branch points) come back in `blocked`; those steps stay
 * where they are, to be surfaced by the existing broken-step check.
 */
export function repairFlowsAfterRemovingDiagramElements(
  flows: Record<string, Flow>,
  removedComponentIds: ReadonlySet<string>,
  removedConnectionIds: ReadonlySet<string>,
): FlowSewReport[] {
  const reports: FlowSewReport[] = [];

  for (const flow of Object.values(flows)) {
    const stepIds = getFlowStepIdsReferencingRemovedElements(
      flow,
      removedComponentIds,
      removedConnectionIds,
    );
    if (stepIds.length === 0) continue;

    const before = computeFlowStepLabels(flow);
    const context = stepIds.map((stepId) => ({
      stepId,
      step: flow.steps[stepId],
      predecessorId: predecessorsOf(flow, stepId)[0],
    }));

    const { steps, entryStepId, blocked, removedStepIds } = sewOnDelete(flow, stepIds);
    flow.steps = steps;
    flow.entryStepId = entryStepId;

    const after = computeFlowStepLabels(flow);
    const removed = new Set(removedStepIds);
    const joins: FlowSewJoin[] = context
      .filter((entry) => removed.has(entry.stepId))
      .map(({ stepId, step, predecessorId }) => {
        const successorId = step?.next;
        const join: FlowSewJoin = { stepId };
        if (step?.componentId !== undefined) join.componentId = step.componentId;
        if (step?.connectionId !== undefined) join.connectionId = step.connectionId;
        const removedLabel = before.labels[stepId];
        if (removedLabel !== undefined) join.removedLabel = removedLabel;
        const fromLabel = predecessorId ? after.labels[predecessorId] : undefined;
        if (fromLabel !== undefined) join.fromLabel = fromLabel;
        const toLabel = successorId ? after.labels[successorId] : undefined;
        if (toLabel !== undefined) join.toLabel = toLabel;
        return join;
      });

    reports.push({ flowId: flow.id, flowName: flow.name, joins, blocked });
  }

  return reports;
}

/** One sewn join, ready to be said to the user. */
export interface FlowSewNotice {
  flowId: string;
  flowName: string;
  /** What left the diagram: the name of the component or the connection's label. */
  elementName?: string;
  /** After the sew, the step numbered `fromLabel` leads to the one numbered `toLabel`. */
  fromLabel?: string;
  toLabel?: string;
}

/**
 * Turns the reports into one notice per sewn join, naming what left the
 * diagram. Names are looked up rather than read off the flow because the
 * element is already gone by the time the flow is sewn.
 */
export function toFlowSewNotices(
  reports: readonly FlowSewReport[],
  elementNames: ReadonlyMap<string, string>,
): FlowSewNotice[] {
  const notices: FlowSewNotice[] = [];
  for (const report of reports) {
    for (const join of report.joins) {
      const elementId = join.componentId ?? join.connectionId;
      const notice: FlowSewNotice = { flowId: report.flowId, flowName: report.flowName };
      const elementName = elementId ? elementNames.get(elementId) : undefined;
      if (elementName !== undefined) notice.elementName = elementName;
      if (join.fromLabel !== undefined) notice.fromLabel = join.fromLabel;
      if (join.toLabel !== undefined) notice.toLabel = join.toLabel;
      notices.push(notice);
    }
  }
  return notices;
}
