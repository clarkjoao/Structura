import { useMemo } from "react";
import type { Flow } from "@/features/diagram";
import { useRecordingMode } from "./RecordingModeContext";
import { useFlowPlayback } from "./FlowPlaybackContext";
import {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowHighlight,
  buildCoverage,
  buildRecordingInfo,
} from "./flowState";

interface UseFlowStateParams {
  flows: Flow[];
}

export function useFlowState({ flows }: UseFlowStateParams) {
  const { isRecording, recordingSteps, recordingContext, branchOwnership } = useRecordingMode();
  const { activeFlow, currentStepId, currentStep, isPlaying, history } = useFlowPlayback();

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return EMPTY_FLOW_HIGHLIGHT;
    return buildFlowHighlight(activeFlow, currentStepId, history);
  }, [isPlaying, activeFlow, currentStepId, history]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording) return null;
    return buildCoverage(flows);
  }, [flows, isPlaying, isRecording]);

  const stepsForRecordingOverlay = useMemo(() => {
    if (!isRecording || !recordingSteps?.length) return [];
    if (recordingContext.mode !== "branch-record") return recordingSteps;
    const { conditionStepId, branchIndex } = recordingContext;
    return recordingSteps.filter((s) => {
      const o = branchOwnership.get(s.id);
      return o && o.conditionStepId === conditionStepId && o.branchIndex === branchIndex;
    });
  }, [isRecording, recordingSteps, recordingContext, branchOwnership]);

  const recordingInfo = useMemo(() => {
    if (!isRecording || !stepsForRecordingOverlay?.length) return null;
    return buildRecordingInfo(stepsForRecordingOverlay);
  }, [isRecording, stepsForRecordingOverlay]);

  return { isPlaying, activeStep: currentStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStepId };
}
