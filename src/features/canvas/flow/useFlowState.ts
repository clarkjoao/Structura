import { useMemo } from "react";
import type { Flow, FlowStep } from "@/features/diagram";
import { useFlowMode } from "./FlowModeContext";
import type { BranchOwnerInfo, RecordingContext } from "./flowMode.types";
import {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowHighlight,
  buildCoverage,
  buildRecordingInfo,
} from "./flowState";

const EMPTY_HISTORY: string[] = [];
const EMPTY_STEPS: FlowStep[] = [];
const EMPTY_BRANCH = new Map<string, BranchOwnerInfo>();
const TRUNK_CONTEXT: RecordingContext = { mode: "trunk" };

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
  const { isPlaying, currentStep: activeStep, isRecording } = flowMode;

  const recordingState = flowMode.mode.kind === "recording" ? flowMode.mode : null;
  const recordingSteps = recordingState?.steps ?? EMPTY_STEPS;
  const recordingContext = recordingState?.context ?? TRUNK_CONTEXT;
  const branchOwnership = recordingState?.branchOwnership ?? EMPTY_BRANCH;

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return EMPTY_FLOW_HIGHLIGHT;
    return buildFlowHighlight(activeFlow, currentStepId, history);
  }, [isPlaying, activeFlow, currentStepId, history]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording || isCompareMode) return null;
    // Intentionally depends on full `flows`: coverage must refresh when steps mutate.
    return buildCoverage(flows);
  }, [flows, isPlaying, isRecording, isCompareMode]);

  const stepsForRecordingOverlay = useMemo(() => {
    if (!isRecording || !recordingSteps.length) return [];
    if (recordingContext.mode !== "branch-record") return recordingSteps;
    const { conditionStepId, branchIndex } = recordingContext;
    return recordingSteps.filter((step) => {
      const owner = branchOwnership.get(step.id);
      return (
        owner &&
        owner.conditionStepId === conditionStepId &&
        owner.branchIndex === branchIndex
      );
    });
  }, [isRecording, recordingSteps, recordingContext, branchOwnership]);

  const recordingInfo = useMemo(() => {
    if (!isRecording || !stepsForRecordingOverlay.length) return null;
    return buildRecordingInfo(stepsForRecordingOverlay);
  }, [isRecording, stepsForRecordingOverlay]);

  return { isPlaying, activeStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStepId };
}
