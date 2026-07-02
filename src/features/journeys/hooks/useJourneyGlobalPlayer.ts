import { useCallback } from "react";
import { useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import { useDiagramActions } from "@/features/diagram";
import { useJourneyPlayer } from "./useJourneyPlayer";
import { useJourneySteps } from "../store/selectors/journeys.selectors";
import type { JourneyStep } from "../types";

export interface SelectStepPlaybackOptions {
  preserveFlowPlayback?: boolean;
}

interface UseJourneyGlobalPlayerParams {
  journeyId: string;
  selectedStepId: string | null;
  onSelectStep: (stepId: string, options?: SelectStepPlaybackOptions) => void;
}

export function useJourneyGlobalPlayer({
  journeyId,
  selectedStepId,
  onSelectStep,
}: UseJourneyGlobalPlayerParams) {
  const flowMode = useFlowMode();
  const journeyPlayer = useJourneyPlayer();
  const { openDiagram } = useDiagramActions();
  const steps = useJourneySteps(journeyId);

  const isGlobalPlaying =
    journeyPlayer.mode.kind === "playing" && journeyPlayer.mode.journeyId === journeyId;

  const playStep = useCallback(
    (step: JourneyStep) => {
      if (!flowMode.isIdle) {
        if (flowMode.isRecording) {
          flowMode.cancelRecording();
        } else {
          flowMode.exitPlay();
        }
      }
      journeyPlayer.setPlaybackContext(journeyId, step.id);
      onSelectStep(step.id, { preserveFlowPlayback: true });
      if (step.flowId && step.diagramId.length > 0) {
        journeyPlayer.startFlowPlayback(step.flowId, step.diagramId);
      } else if (step.diagramId.length > 0) {
        openDiagram(step.diagramId);
      }
    },
    [flowMode, journeyId, journeyPlayer, onSelectStep, openDiagram],
  );

  const startGlobalPlay = useCallback(() => {
    if (steps.length === 0) return;
    if (!flowMode.isIdle || journeyPlayer.mode.kind !== "idle") return;
    const target =
      (selectedStepId ? steps.find((item) => item.id === selectedStepId) : null) ?? steps[0];
    if (!target) return;
    playStep(target);
  }, [flowMode, journeyPlayer, playStep, selectedStepId, steps]);

  const stopGlobalPlay = useCallback(() => {
    journeyPlayer.exit();
    flowMode.exitPlay();
  }, [flowMode, journeyPlayer]);

  const goToNextStep = useCallback(() => {
    const currentIndex = steps.findIndex((item) => item.id === selectedStepId);
    if (currentIndex < 0 || currentIndex >= steps.length - 1) return;
    const next = steps[currentIndex + 1];
    if (!next) return;
    playStep(next);
  }, [playStep, selectedStepId, steps]);

  const goToPrevStep = useCallback(() => {
    const currentIndex = steps.findIndex((item) => item.id === selectedStepId);
    if (currentIndex <= 0) return;
    const prev = steps[currentIndex - 1];
    if (!prev) return;
    playStep(prev);
  }, [playStep, selectedStepId, steps]);

  const currentStepIndex = steps.findIndex((item) => item.id === selectedStepId);
  const hasNextStep = currentStepIndex >= 0 && currentStepIndex < steps.length - 1;
  const hasPrevStep = currentStepIndex > 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  return {
    isGlobalPlaying,
    startGlobalPlay,
    stopGlobalPlay,
    goToNextStep,
    goToPrevStep,
    hasNextStep,
    hasPrevStep,
    isLastStep,
    steps,
  };
}
