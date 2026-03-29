import type { Flow, FlowStep } from "../model/flow.types";
import { isFlowLinkStep } from "../model/flow.types";
import { isConditionStep } from "./flow-traversal";

/** Maps step id → which condition branch owns it during recording. */
export type BranchOwnershipMap = Map<string, { conditionStepId: string; branchIndex: number }>;

/**
 * Builds the same graph-shaped `steps` record as finalize recording (ModelExplorer).
 * Used for Mermaid preview, branch step counts, etc.
 */
export function buildFlowFromRecordingSnapshot(
  steps: FlowStep[],
  branchOwnership: BranchOwnershipMap,
  opts?: { name?: string; diagramId?: string; id?: string },
): Flow {
  const stepsRecord: Record<string, FlowStep> = {};
  for (const s of steps) {
    stepsRecord[s.id] = { ...s };
  }

  const conditionBranches = new Map<string, NonNullable<Extract<FlowStep, { type: "condition" }>["branches"]>>();
  for (const s of steps) {
    if (isConditionStep(s) && s.branches) {
      conditionBranches.set(s.id, s.branches.map((b) => ({ ...b })));
    }
  }

  const conditionSteps = steps.filter(isConditionStep);
  for (const condStep of conditionSteps) {
    if (!condStep.branches) continue;
    const mutableBranches = conditionBranches.get(condStep.id);
    if (!mutableBranches) continue;

    for (let bi = 0; bi < condStep.branches.length; bi++) {
      const branchSteps = steps.filter((s) => {
        const info = branchOwnership.get(s.id);
        return (
          info !== undefined &&
          info.conditionStepId === condStep.id &&
          info.branchIndex === bi
        );
      });

      if (branchSteps.length === 0) continue;

      mutableBranches[bi] = { ...mutableBranches[bi], nextId: branchSteps[0].id };

      for (let j = 0; j < branchSteps.length - 1; j++) {
        const branchStep = branchSteps[j];
        if (isFlowLinkStep(branchStep)) break;
        const branchRecord = stepsRecord[branchStep.id];
        if (!isFlowLinkStep(branchRecord)) {
          stepsRecord[branchStep.id] = { ...branchRecord, next: branchSteps[j + 1].id };
        }
      }
    }

    const conditionRecord = stepsRecord[condStep.id];
    if (isConditionStep(conditionRecord)) {
      stepsRecord[condStep.id] = { ...conditionRecord, branches: mutableBranches };
    }
  }

  const trunkSteps = steps.filter((s) => !branchOwnership.has(s.id));
  for (let i = 0; i < trunkSteps.length - 1; i++) {
    const step = trunkSteps[i];
    if (isConditionStep(step) || isFlowLinkStep(step)) continue;
    const trunkRecord = stepsRecord[step.id];
    if (!isConditionStep(trunkRecord) && !isFlowLinkStep(trunkRecord)) {
      stepsRecord[step.id] = { ...trunkRecord, next: trunkSteps[i + 1].id };
    }
  }

  return {
    id: opts?.id ?? "recording-preview",
    name: opts?.name ?? "",
    mermaid: "",
    diagramId: opts?.diagramId ?? "",
    entryStepId: steps[0]?.id,
    steps: stepsRecord,
  };
}
