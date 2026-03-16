import { useMemo } from "react";
import type { Flow } from "@/features/diagram";
import { useRecordingMode } from "../contexts/RecordingModeContext";
import {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowHighlight,
  buildCoverage,
  buildRecordingInfo,
} from "../models/flowState";

interface UseFlowStateParams {
  activeFlow?: Flow | null;
  currentStep?: number;
  flows: Flow[];
}

export function useFlowState({
  activeFlow,
  currentStep,
  flows,
}: UseFlowStateParams) {
  const { isRecording, recordingSteps } = useRecordingMode();
  const isPlaying = !!activeFlow && currentStep !== undefined && currentStep >= 0;
  const stepIndex = currentStep ?? 0;

  const activeStep = isPlaying && activeFlow
    ? activeFlow.steps[stepIndex] ?? null
    : null;

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

  return { isPlaying, activeStep, flowHighlight, coverage, recordingInfo };
}
