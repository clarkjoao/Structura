import { useMemo } from "react";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildFlowOutline, getBranchRows } from "@/features/diagram";
import { useFlowMode } from "./FlowModeContext";
import {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowHighlight,
  buildCoverage,
  buildRecordingInfo,
} from "./flowState";

const EMPTY_HISTORY: string[] = [];

interface UseFlowStateParams {
  flows: Flow[];
  isCompareMode?: boolean;
}

export function useFlowState({ flows, isCompareMode = false }: UseFlowStateParams) {
  const flowMode = useFlowMode();
  const playbackState = flowMode.mode.kind === "playing" ? flowMode.mode : null;
  const activeFlow = playbackState?.flow ?? null;
  const currentStepId = playbackState?.currentStepId ?? null;
  const history = playbackState?.history ?? EMPTY_HISTORY;
  const { isPlaying, currentStep: activeStep, isRecording, recordingFlowId } = flowMode;
  const recordingContext = flowMode.recordingContext;

  const recordingFlow = useMemo(
    () => (recordingFlowId ? (flows.find((flow) => flow.id === recordingFlowId) ?? null) : null),
    [flows, recordingFlowId],
  );

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return EMPTY_FLOW_HIGHLIGHT;
    return buildFlowHighlight(activeFlow, currentStepId, history);
  }, [isPlaying, activeFlow, currentStepId, history]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording || isCompareMode) return null;
    // Intentionally depends on full `flows`: coverage must refresh when steps mutate.
    return buildCoverage(flows);
  }, [flows, isPlaying, isRecording, isCompareMode]);

  /**
   * The steps the recorder is showing, in reading order — the whole script, or
   * just the branch being recorded. Read off the stored flow: the recorder
   * keeps no copy of its own any more.
   */
  const recordingInfo = useMemo(() => {
    if (!isRecording || !recordingFlow) return null;
    const outline = buildFlowOutline(recordingFlow);
    const rows =
      recordingContext.mode === "branch-record"
        ? getBranchRows(outline, recordingContext.conditionStepId, recordingContext.branchIndex)
        : outline.rows;
    const steps = rows
      .map((row) => recordingFlow.steps[row.stepId])
      .filter((step): step is FlowStep => Boolean(step));
    if (steps.length === 0) return null;
    return buildRecordingInfo(steps);
  }, [isRecording, recordingContext, recordingFlow]);

  return {
    isPlaying,
    activeStep,
    flowHighlight,
    coverage,
    recordingInfo,
    activeFlow,
    currentStepId,
  };
}
