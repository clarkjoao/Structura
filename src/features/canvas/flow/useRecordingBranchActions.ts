import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { generateId } from "@/features/diagram";
import type { FlowStep } from "@/features/diagram";
import type { FlowMode } from "./flowMode.types";
import type { BranchOwnerInfo } from "./flowMode.types";
import { findLastBranchStepIndex, getDisplayStepsFromRecording } from "./flowModeRecording.utils";

export interface UseRecordingBranchActionsResult {
  onConvertStepToCondition: (
    index: number,
    conditionLabel: string,
    branchLabels: string[],
  ) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (
    conditionStepId: string,
    branchIndex: number,
    label: string,
  ) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
  onEnterBranchRecording: (conditionStepId: string, branchIndex: number) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;
}

export function useRecordingBranchActions(
  mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
  branchOwnershipRef: MutableRefObject<Map<string, BranchOwnerInfo>>,
): UseRecordingBranchActionsResult {
  const onConvertStepToCondition = useCallback(
    (index: number, conditionLabel: string, branchLabels: string[]) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const target = panel[index];
        if (!target) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) => {
            if (flowStep.id !== target.id) return flowStep;
            const branches = branchLabels.map((label) => ({
              label,
              nextId: generateId("step"),
            }));
            return {
              ...flowStep,
              type: "condition" as const,
              conditionLabel,
              branches,
              next: undefined,
            };
          }),
          context: { mode: "branch-select", conditionStepId: target.id },
        };
      });
    },
    [setMode],
  );

  const onUpdateConditionLabel = useCallback(
    (index: number, label: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const target = panel[index];
        if (!target) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) =>
            flowStep.id === target.id ? { ...flowStep, conditionLabel: label } : flowStep,
          ),
        };
      });
    },
    [setMode],
  );

  const onAddBranchLabel = useCallback(
    (conditionStepId: string, label: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep || condStep.type !== "condition") return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) => {
            if (flowStep.id !== condStep.id) return flowStep;
            return {
              ...flowStep,
              branches: [...(flowStep.branches ?? []), { label, nextId: generateId("step") }],
            };
          }),
        };
      });
    },
    [setMode],
  );

  const onRemoveBranchLabel = useCallback(
    (conditionStepId: string, branchIndex: number) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep?.branches || condStep.branches.length <= 2) return prev;
        const ownership = prev.branchOwnership;
        const nextSteps = prev.steps
          .filter((flowStep) => {
            const branchOwner = ownership.get(flowStep.id);
            if (
              branchOwner &&
              branchOwner.conditionStepId === condStep.id &&
              branchOwner.branchIndex === branchIndex
            ) {
              return false;
            }
            return true;
          })
          .map((flowStep) => {
            if (flowStep.id !== condStep.id) return flowStep;
            return {
              ...flowStep,
              branches: flowStep.branches!.filter((_, bi) => bi !== branchIndex),
            };
          });
        const nextOwnership = new Map<string, BranchOwnerInfo>();
        for (const [stepId, info] of prev.branchOwnership) {
          if (info.conditionStepId !== conditionStepId) {
            nextOwnership.set(stepId, info);
          } else if (info.branchIndex < branchIndex) {
            nextOwnership.set(stepId, info);
          } else if (info.branchIndex > branchIndex) {
            nextOwnership.set(stepId, { ...info, branchIndex: info.branchIndex - 1 });
          }
        }
        branchOwnershipRef.current = nextOwnership;
        return { ...prev, steps: nextSteps, branchOwnership: nextOwnership };
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onUpdateBranchLabel = useCallback(
    (conditionStepId: string, branchIndex: number, label: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep?.branches) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) => {
            if (flowStep.id !== condStep.id) return flowStep;
            return {
              ...flowStep,
              branches: flowStep.branches!.map((branch, bi) =>
                bi === branchIndex ? { ...branch, label } : branch,
              ),
            };
          }),
        };
      });
    },
    [setMode],
  );

  const onAddConditionStep = useCallback(
    (conditionLabel: string, branchLabels: string[]) => {
      const id = generateId("step");
      const branches = branchLabels.map((label) => ({
        label,
        nextId: generateId("step"),
      }));
      const newStep: FlowStep = { id, type: "condition", conditionLabel, branches };

      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        let nextSteps: FlowStep[];
        let nextOwnership = prev.branchOwnership;
        if (prev.context.mode !== "branch-record") {
          nextSteps = [...prev.steps, newStep];
        } else {
          const { conditionStepId, branchIndex } = prev.context;
          const insertAfterIdx = findLastBranchStepIndex(
            prev.steps,
            conditionStepId,
            branchIndex,
            prev.branchOwnership,
          );
          const newArr = [...prev.steps];
          newArr.splice(insertAfterIdx + 1, 0, newStep);
          nextSteps = newArr;
          nextOwnership = new Map(prev.branchOwnership);
          nextOwnership.set(id, { conditionStepId, branchIndex });
        }
        branchOwnershipRef.current = nextOwnership;
        return {
          ...prev,
          steps: nextSteps,
          branchOwnership: nextOwnership,
          context: { mode: "branch-select", conditionStepId: id },
        };
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onEnterBranchRecording = useCallback(
    (conditionStepId: string, branchIndex: number) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep || condStep.type !== "condition" || !condStep.branches?.[branchIndex])
          return prev;
        return {
          ...prev,
          context: {
            mode: "branch-record",
            conditionStepId,
            branchIndex,
            branchLabel: condStep.branches[branchIndex].label,
          },
        };
      });
    },
    [setMode],
  );

  const onOpenBranchSelect = useCallback(
    (conditionStepId: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        return { ...prev, context: { mode: "branch-select", conditionStepId } };
      });
    },
    [setMode],
  );

  return {
    onConvertStepToCondition,
    onUpdateConditionLabel,
    onAddBranchLabel,
    onRemoveBranchLabel,
    onUpdateBranchLabel,
    onAddConditionStep,
    onEnterBranchRecording,
    onOpenBranchSelect,
  };
}
