import type { Flow, FlowStep } from "@/features/diagram";
import type { BranchOwnerInfo, FlowMode, RecordingContext } from "./flowMode.types";

export type { BranchOwnerInfo, RecordingContext };

export function getDisplayStepsFromRecording(
  steps: FlowStep[],
  recordingContext: RecordingContext,
  ownership: Map<string, BranchOwnerInfo>,
): FlowStep[] {
  if (recordingContext.mode !== "branch-record") return steps;
  const { conditionStepId, branchIndex } = recordingContext;
  return steps.filter((step) => {
    const owner = ownership.get(step.id);
    return owner && owner.conditionStepId === conditionStepId && owner.branchIndex === branchIndex;
  });
}

export function findLastBranchStepIndex(
  steps: FlowStep[],
  conditionStepId: string,
  branchIndex: number,
  ownership: Map<string, BranchOwnerInfo>,
): number {
  let lastIdx = steps.findIndex((step) => step.id === conditionStepId);
  for (let i = lastIdx + 1; i < steps.length; i++) {
    const info = ownership.get(steps[i].id);
    if (info && info.conditionStepId === conditionStepId && info.branchIndex === branchIndex) {
      lastIdx = i;
    }
  }
  return lastIdx;
}

export function appendRecordedStep(
  previousMode: FlowMode,
  nextStep: FlowStep,
  branchOwnershipRef: { current: Map<string, BranchOwnerInfo> },
): FlowMode {
  if (previousMode.kind !== "recording") return previousMode;
  if (previousMode.context.mode !== "branch-record") {
    return { ...previousMode, steps: [...previousMode.steps, nextStep] };
  }

  const { conditionStepId, branchIndex } = previousMode.context;
  const insertAfterIndex = findLastBranchStepIndex(
    previousMode.steps,
    conditionStepId,
    branchIndex,
    previousMode.branchOwnership,
  );
  const nextSteps = [...previousMode.steps];
  nextSteps.splice(insertAfterIndex + 1, 0, nextStep);

  const nextBranchOwnership = new Map(previousMode.branchOwnership);
  nextBranchOwnership.set(nextStep.id, { conditionStepId, branchIndex });
  branchOwnershipRef.current = nextBranchOwnership;

  return {
    ...previousMode,
    steps: nextSteps,
    branchOwnership: nextBranchOwnership,
  };
}

export function buildOrderedSteps(
  flow: Flow,
): { ordered: FlowStep[]; ownership: Map<string, BranchOwnerInfo> } {
  const stepValues = Object.values(flow.steps);
  const ordered: FlowStep[] = [];
  const visited = new Set<string>();
  const ownership = new Map<string, BranchOwnerInfo>();

  function visit(stepId: string | undefined, branchInfo?: BranchOwnerInfo) {
    if (!stepId || visited.has(stepId)) return;
    visited.add(stepId);
    const flowStep = flow.steps[stepId];
    if (!flowStep) return;
    ordered.push({ ...flowStep });
    if (branchInfo) {
      ownership.set(flowStep.id, branchInfo);
    }
    if (flowStep.branches) {
      for (let branchIdx = 0; branchIdx < flowStep.branches.length; branchIdx++) {
        visit(flowStep.branches[branchIdx].nextId, {
          conditionStepId: flowStep.id,
          branchIndex: branchIdx,
        });
      }
    }
    if (flowStep.next) visit(flowStep.next, branchInfo);
  }

  visit(flow.entryStepId);
  for (const flowStep of stepValues) {
    if (!visited.has(flowStep.id)) ordered.push({ ...flowStep });
  }

  return { ordered, ownership };
}
