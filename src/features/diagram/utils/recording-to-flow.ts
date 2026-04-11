import type { Flow, FlowStep } from "../model/flow.types";


export type BranchOwnershipMap = Map<string, { conditionStepId: string; branchIndex: number }>;


export function buildFlowFromRecordingSnapshot(
  steps: FlowStep[],
  branchOwnership: BranchOwnershipMap,
  opts?: { name?: string; diagramId?: string; id?: string },
): Flow {
  const stepsRecord: Record<string, FlowStep> = {};
  for (const s of steps) {
    stepsRecord[s.id] = { ...s };
  }

  const conditionSteps = steps.filter((s) => s.type === "condition");

  const trunkAndCondition = steps.filter((s) => !branchOwnership.has(s.id));
  for (let i = 0; i < trunkAndCondition.length - 1; i++) {
    const step = trunkAndCondition[i];
    if (step.type !== "condition") {
      stepsRecord[step.id] = { ...stepsRecord[step.id], next: trunkAndCondition[i + 1].id };
    }
  }

  for (const condStep of conditionSteps) {
    if (!condStep.branches) continue;
    for (let bi = 0; bi < condStep.branches.length; bi++) {
      const branchSteps = steps.filter((s) => {
        const info = branchOwnership.get(s.id);
        return info && info.conditionStepId === condStep.id && info.branchIndex === bi;
      });

      if (branchSteps.length > 0) {
        stepsRecord[condStep.id] = {
          ...stepsRecord[condStep.id],
          branches: stepsRecord[condStep.id].branches?.map((b, idx) =>
            idx === bi ? { ...b, nextId: branchSteps[0].id } : b,
          ),
        };
        for (let j = 0; j < branchSteps.length - 1; j++) {
          stepsRecord[branchSteps[j].id] = {
            ...stepsRecord[branchSteps[j].id],
            next: branchSteps[j + 1].id,
          };
        }
      }
    }
  }

  const entryStepId = steps[0]?.id;

  return {
    id: opts?.id ?? "recording-preview",
    name: opts?.name ?? "",
    mermaid: "",
    diagramId: opts?.diagramId ?? "",
    entryStepId,
    steps: stepsRecord,
  };
}
