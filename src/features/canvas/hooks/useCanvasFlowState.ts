import type { Flow } from "@/features/diagram";
import { useFlowState } from "../flow/useFlowState";
import { useFlowMode } from "../flow/FlowModeContext";

export function useCanvasFlowState(params: { flows: Flow[]; isCompareMode: boolean }) {
  const { isRecording } = useFlowMode();
  const { isPlaying, activeStep, flowHighlight, coverage, flowBadges, activeFlow, currentStepId } =
    useFlowState({
      flows: params.flows,
      isCompareMode: params.isCompareMode,
    });
  const isPlayingEffective = params.isCompareMode ? false : isPlaying;

  return {
    isPlaying,
    isPlayingEffective,
    isRecording,
    activeStep,
    activeFlow,
    currentStepId,
    flowHighlight,
    coverage,
    flowBadges,
  };
}
