import type { Flow, FlowStep } from "../model/flow.types";
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

/**
 * Sews every flow after diagram elements were removed. Returns the removals
 * that were held back (branch points), so a caller can surface them; the two
 * store slices that call this today ignore the value, and the steps stay in
 * place to be reported by the existing broken-step check.
 */
export function repairFlowsAfterRemovingDiagramElements(
  flows: Record<string, Flow>,
  removedComponentIds: ReadonlySet<string>,
  removedConnectionIds: ReadonlySet<string>,
): { flowId: string; blocked: SewBlockedStep[] }[] {
  const held: { flowId: string; blocked: SewBlockedStep[] }[] = [];

  for (const flow of Object.values(flows)) {
    const stepIds = getFlowStepIdsReferencingRemovedElements(
      flow,
      removedComponentIds,
      removedConnectionIds,
    );
    if (stepIds.length === 0) continue;
    const { steps, entryStepId, blocked } = sewOnDelete(flow, stepIds);
    flow.steps = steps;
    flow.entryStepId = entryStepId;
    if (blocked.length > 0) held.push({ flowId: flow.id, blocked });
  }

  return held;
}
