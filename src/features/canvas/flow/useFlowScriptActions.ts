import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { heldBackMessage, refusalMessage } from "./flowRefusalMessage";
import type { FlowStep, FlowStoreResult, MoveStepTarget } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";

export interface FlowScriptActions {
  updateStep: (stepId: string, patch: Partial<FlowStep>) => void;
  removeStep: (stepId: string) => void;
  moveStep: (stepId: string, target: MoveStepTarget) => void;
  insertStepAfter: (stepId: string) => void;
  convertToCondition: (stepId: string, conditionLabel: string, branchLabels: string[]) => void;
  addBranch: (conditionStepId: string, label: string) => void;
  removeBranch: (conditionStepId: string, branchIndex: number) => void;
  setBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
}

/**
 * The script panel's gestures, bound to one flow.
 *
 * Every one of them goes through the store, and every refusal is said out
 * loud: a gesture the graph will not take is named, never reverted in silence.
 */
export function useFlowScriptActions(flowId: string | null): FlowScriptActions {
  const { t } = useTranslation();
  const actions = useDiagramActions();

  return useMemo(() => {
    const announce = (result: FlowStoreResult): FlowStoreResult => {
      if (!result.ok) {
        toast.warning(refusalMessage(t, result.code));
        return result;
      }
      // A held-back removal reports success — it changed nothing on purpose —
      // so it needs saying out loud too, or the click looks like it did nothing.
      for (const held of result.blocked) {
        toast.warning(heldBackMessage(t, held.code));
      }
      return result;
    };
    const noFlow = (): FlowStoreResult => ({
      ok: false,
      code: "unknown_flow",
      detail: "no flow is open",
    });

    return {
      updateStep: (stepId, patch) => {
        if (!flowId) return;
        actions.updateFlowStep(flowId, stepId, patch);
      },
      removeStep: (stepId) => {
        announce(flowId ? actions.removeFlowSteps(flowId, [stepId]) : noFlow());
      },
      moveStep: (stepId, target) => {
        announce(flowId ? actions.moveFlowStep(flowId, stepId, target) : noFlow());
      },
      insertStepAfter: (stepId) => {
        announce(flowId ? actions.insertFlowStepAt(flowId, { kind: "after", stepId }) : noFlow());
      },
      convertToCondition: (stepId, conditionLabel, branchLabels) => {
        announce(
          flowId
            ? actions.convertStepToCondition(flowId, stepId, conditionLabel, branchLabels)
            : noFlow(),
        );
      },
      addBranch: (conditionStepId, label) => {
        announce(flowId ? actions.addFlowBranch(flowId, conditionStepId, label) : noFlow());
      },
      removeBranch: (conditionStepId, branchIndex) => {
        announce(
          flowId ? actions.removeFlowBranch(flowId, conditionStepId, branchIndex) : noFlow(),
        );
      },
      setBranchLabel: (conditionStepId, branchIndex, label) => {
        if (!flowId) return;
        actions.setFlowBranchLabel(flowId, conditionStepId, branchIndex, label);
      },
    };
  }, [actions, flowId, t]);
}
