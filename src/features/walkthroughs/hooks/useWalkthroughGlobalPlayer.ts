import { useCallback } from "react";
import { useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import { useDiagramActions } from "@/features/diagram";
import { useWalkthroughPlayer } from "./useWalkthroughPlayer";
import { useWalkthroughSteps } from "../store/selectors/walkthroughs.selectors";
import type { WalkthroughStep } from "../types";

export interface SelectStepPlaybackOptions {
  preserveFlowPlayback?: boolean;
}

interface UseWalkthroughGlobalPlayerParams {
  walkthroughId: string;
  selectedStepId: string | null;
  onSelectStep: (stepId: string, options?: SelectStepPlaybackOptions) => void;
}

export function useWalkthroughGlobalPlayer({
  walkthroughId,
  selectedStepId,
  onSelectStep,
}: UseWalkthroughGlobalPlayerParams) {
  const flowMode = useFlowMode();
  const walkthroughPlayer = useWalkthroughPlayer();
  const { openDiagram } = useDiagramActions();
  const steps = useWalkthroughSteps(walkthroughId);

  const isGlobalPlaying =
    walkthroughPlayer.mode.kind === "playing" &&
    walkthroughPlayer.mode.walkthroughId === walkthroughId;

  const playStep = useCallback(
    (step: WalkthroughStep) => {
      if (!flowMode.isIdle) {
        if (flowMode.isRecording) {
          flowMode.cancelRecording();
        } else {
          flowMode.exitPlay();
        }
      }
      walkthroughPlayer.setPlaybackContext(walkthroughId, step.id);
      onSelectStep(step.id, { preserveFlowPlayback: true });
      if (step.flowId && step.diagramId.length > 0) {
        walkthroughPlayer.startFlowPlayback(step.flowId, step.diagramId);
      } else if (step.diagramId.length > 0) {
        openDiagram(step.diagramId);
      }
    },
    [flowMode, walkthroughId, walkthroughPlayer, onSelectStep, openDiagram],
  );

  const startGlobalPlay = useCallback(() => {
    if (steps.length === 0) return;
    if (!flowMode.isIdle || walkthroughPlayer.mode.kind !== "idle") return;
    const target =
      (selectedStepId ? steps.find((item) => item.id === selectedStepId) : null) ?? steps[0];
    if (!target) return;
    playStep(target);
  }, [flowMode, walkthroughPlayer, playStep, selectedStepId, steps]);

  const stopGlobalPlay = useCallback(() => {
    walkthroughPlayer.exit();
    flowMode.exitPlay();
  }, [flowMode, walkthroughPlayer]);

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
