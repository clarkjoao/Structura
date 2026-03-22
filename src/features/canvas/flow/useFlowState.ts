import { useMemo } from "react";
import type { Flow } from "@/features/diagram";
import { useRecordingMode } from "./RecordingModeContext";
import { useFlowPlayback } from "./FlowPlaybackContext";
import {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowHighlight,
  buildCoverage,
  buildRecordingInfo,
  safeFlowSteps,
} from "./flowState";

interface UseFlowStateParams {
  flows: Flow[];
}

export function useFlowState({ flows }: UseFlowStateParams) {
  const { isRecording, recordingSteps } = useRecordingMode();
  const { activeFlow, currentStep, isPlaying } = useFlowPlayback();
  const stepIndex = currentStep ?? 0;

  const activeStep =
    isPlaying && activeFlow ? safeFlowSteps(activeFlow)[stepIndex] ?? null : null;

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow) return EMPTY_FLOW_HIGHLIGHT;
    return buildFlowHighlight(activeFlow, stepIndex);
  }, [isPlaying, activeFlow, stepIndex]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording) return null;
    return buildCoverage(flows);
  }, [flows, isPlaying, isRecording]);

  const recordingInfo = useMemo(() => {
    if (!isRecording || !recordingSteps?.length) return null;
    return buildRecordingInfo(recordingSteps);
  }, [isRecording, recordingSteps]);

  return { isPlaying, activeStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStep };
}
