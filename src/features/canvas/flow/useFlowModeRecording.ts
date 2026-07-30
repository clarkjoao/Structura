import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { Flow } from "@/features/diagram";
import type { FlowMode } from "./flowMode.types";
import type { BranchOwnerInfo, RecordingContext, RecordingFinalizeData } from "./flowMode.types";
import { getDisplayStepsFromRecording } from "./flowModeRecording.utils";
import { useRecordingLifecycle } from "./useRecordingLifecycle";
import { useRecordingStepActions } from "./useRecordingStepActions";
import { useRecordingBranchActions } from "./useRecordingBranchActions";

// Re-export the utility so the public API is unchanged.
export { getDisplayStepsFromRecording };

export type FlowModeRecordingSlice = {
  startRecording: () => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;
  editFlow: (flow: Flow) => void;
  setRecordingName: (name: string) => void;
  setRecordingDescription: (desc: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  setRecordingContext: (action: SetStateAction<RecordingContext>) => void;
  onRecordNodeClick: (nodeId: string) => void;
  onRecordEdgeClick: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick: (nodeId: string, handleId: string) => void;
  onRecordUndo: () => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, isAsync: boolean) => void;
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
};

export function useFlowModeRecording(
  _mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
  branchOwnershipRef: MutableRefObject<Map<string, BranchOwnerInfo>>,
  onFinalizeRef: RefObject<(data: RecordingFinalizeData) => void>,
  onStartRecordingRef: RefObject<(() => void) | undefined>,
): FlowModeRecordingSlice {
  // Each sub-hook owns its focused slice of callbacks — no single useMemo wrapper over 25 callbacks.
  const lifecycle = useRecordingLifecycle(
    _mode,
    setMode,
    branchOwnershipRef,
    onFinalizeRef,
    onStartRecordingRef,
  );
  const stepActions = useRecordingStepActions(_mode, setMode, branchOwnershipRef);
  const branchActions = useRecordingBranchActions(_mode, setMode, branchOwnershipRef);

  return {
    startRecording: lifecycle.startRecording,
    cancelRecording: lifecycle.cancelRecording,
    finalizeRecording: lifecycle.finalizeRecording,
    editFlow: lifecycle.editFlow,
    setRecordingName: stepActions.setRecordingName,
    setRecordingDescription: stepActions.setRecordingDescription,
    onAddTag: stepActions.onAddTag,
    onRemoveTag: stepActions.onRemoveTag,
    setRecordingContext: stepActions.setRecordingContext,
    onRecordNodeClick: stepActions.onRecordNodeClick,
    onRecordEdgeClick: stepActions.onRecordEdgeClick,
    onRecordHandleClick: stepActions.onRecordHandleClick,
    onRecordUndo: stepActions.onRecordUndo,
    onDeleteStep: stepActions.onDeleteStep,
    onReorderSteps: stepActions.onReorderSteps,
    onUpdateStepDescription: stepActions.onUpdateStepDescription,
    onUpdateStepDuration: stepActions.onUpdateStepDuration,
    onUpdateStepPayload: stepActions.onUpdateStepPayload,
    onUpdateStepPayloadDirection: stepActions.onUpdateStepPayloadDirection,
    onUpdateStepIsAsync: stepActions.onUpdateStepIsAsync,
    onConvertStepToCondition: branchActions.onConvertStepToCondition,
    onUpdateConditionLabel: branchActions.onUpdateConditionLabel,
    onAddBranchLabel: branchActions.onAddBranchLabel,
    onRemoveBranchLabel: branchActions.onRemoveBranchLabel,
    onUpdateBranchLabel: branchActions.onUpdateBranchLabel,
    onAddConditionStep: branchActions.onAddConditionStep,
    onEnterBranchRecording: branchActions.onEnterBranchRecording,
    onOpenBranchSelect: branchActions.onOpenBranchSelect,
  };
}
