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
  const { isRecording, recordingSteps } = useRecordingMode();
  const { activeFlow, currentStepId, currentStep, isPlaying, history } = useFlowPlayback();

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return EMPTY_FLOW_HIGHLIGHT;
    return buildFlowHighlight(activeFlow, currentStepId, history);
  }, [isPlaying, activeFlow, currentStepId, history]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording) return null;
    return buildCoverage(flows);
  }, [flows, isPlaying, isRecording]);

  const recordingInfo = useMemo(() => {
    if (!isRecording || !recordingSteps?.length) return null;
    return buildRecordingInfo(recordingSteps);
  }, [isRecording, recordingSteps]);

  return { isPlaying, activeStep: currentStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStepId };
}
